"""Append local GPX activities without rewriting existing activity objects."""

import argparse
import json
import math
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
import tempfile

import gpxpy

from config import JSON_FILE
import synced_data_file_logger
from utils import make_activities_file


def timestamp(value):
    date = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return date.replace(tzinfo=timezone.utc) if date.tzinfo is None else date


def read_activities(path):
    rows = json.loads(path.read_text())
    if not isinstance(rows, list) or not rows:
        raise ValueError("现有活动数据必须是非空数组")
    ids = set()
    for row in rows:
        key = str(row["run_id"])
        if key in ids or not row["type"]:
            raise ValueError(f"现有活动 ID 重复或类型缺失: {key}")
        ids.add(key)
        timestamp(row["start_date"])
        timestamp(row["start_date_local"])
        if not math.isfinite(float(row["distance"])) or row["distance"] < 0:
            raise ValueError(f"活动距离无效: {key}")
    return rows


def parse_directory(directory, temporary):
    files = sorted(path for path in directory.glob("*.gpx") if path.is_file())
    if not files:
        raise ValueError("没有 GPX 输入，未改动活动数据")
    expected = {}
    for path in files:
        try:
            with path.open() as stream:
                gpx = gpxpy.parse(stream)
            points = [p for t in gpx.tracks for s in t.segments for p in s.points]
            start, end = gpx.get_time_bounds()
            if len(points) < 2 or start is None or end is None or start.tzinfo is None:
                raise ValueError("需要至少两个轨迹点及带时区的起止时间")
            if end <= start:
                raise ValueError("结束时间必须晚于开始时间")
            key = str(int(start.timestamp() * 1000))
            if key in expected:
                raise ValueError(f"输入文件活动 ID 重复: {expected[key].name}")
            expected[key] = path
        except Exception as error:
            raise ValueError(f"{path.name}: {error}") from error

    # The legacy parser reads/writes imported.json as well as its database.
    # Keep that bookkeeping in the same disposable directory, including dry runs.
    original_log = synced_data_file_logger.SYNCED_FILE
    synced_data_file_logger.SYNCED_FILE = str(temporary / "imported.json")
    output = temporary / "parsed.json"
    try:
        make_activities_file(str(temporary / "data.db"), str(directory), str(output))
    finally:
        synced_data_file_logger.SYNCED_FILE = original_log
    rows = json.loads(output.read_text())
    actual = {str(row["run_id"]) for row in rows}
    missing = set(expected) - actual
    if missing or len(rows) != len(expected) or actual - set(expected):
        names = ", ".join(expected[key].name for key in sorted(missing))
        raise ValueError(f"解析数量不一致，未导入文件: {names or '重复或意外活动 ID'}")
    for row in rows:
        if not row.get("summary_polyline") or not math.isfinite(row["distance"]):
            raise ValueError(
                f"解析结果缺少路线或距离无效: {expected[str(row['run_id'])].name}"
            )
    return rows, expected


def merge(existing, parsed):
    ids = {str(row["run_id"]) for row in existing}
    added, conflicts = [], []
    duplicates = 0
    for row in parsed:
        if str(row["run_id"]) in ids:
            duplicates += 1
            continue
        for other in existing + added:
            seconds = abs(
                (
                    timestamp(row["start_date"]) - timestamp(other["start_date"])
                ).total_seconds()
            )
            tolerance = max(100, float(other["distance"]) * 0.05)
            if (
                row["type"] == other["type"]
                and seconds <= 60
                and abs(row["distance"] - other["distance"]) <= tolerance
            ):
                conflicts.append(f"{row['run_id']} 与 {other['run_id']} 时间和距离接近")
                break
        else:
            added.append(row)
    merged = sorted(existing + added, key=lambda row: row["start_date_local"])
    days = sorted(
        {
            timestamp(row["start_date_local"]).date()
            for row in merged
            if row["type"] == "Run"
        }
    )
    streaks = {}
    for day in days:
        streaks[day] = streaks.get(day - timedelta(days=1), 0) + 1
    for row in added:
        row["streak"] = (
            streaks[timestamp(row["start_date_local"]).date()]
            if row["type"] == "Run"
            else 0
        )
    return merged, added, duplicates, conflicts


def write_import_status(merged, added):
    if not added:
        return
    path = Path(__file__).resolve().parent.parent / "src/static/data-status.json"
    status = {
        "lastImportAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "addedCount": len(added),
        "source": "GPX",
        "dataVersion": max(row["run_id"] for row in added),
        "latestActivityAt": merged[-1]["start_date_local"],
    }
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", dir=path.parent, delete=False
        ) as stream:
            temporary_path = Path(stream.name)
            json.dump(status, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary_path, path)
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path, help="只包含待导入 .gpx 文件的目录")
    parser.add_argument("--dry-run", action="store_true", help="只报告差异，不写入")
    args = parser.parse_args()
    destination = Path(JSON_FILE)
    before = destination.read_bytes()
    existing = read_activities(destination)
    if not args.directory.is_dir():
        raise ValueError(f"目录不存在: {args.directory}")
    with tempfile.TemporaryDirectory(prefix="running-import-") as directory:
        parsed, source_files = parse_directory(
            args.directory.resolve(), Path(directory)
        )
    merged, added, duplicates, conflicts = merge(existing, parsed)
    print(
        f"旧活动数 {len(existing)} / 解析数 {len(parsed)} / 新增数 {len(added)} / 重复数 {duplicates} / 冲突数 {len(conflicts)} / 新活动数 {len(merged)}"
    )
    for row in added:
        activity_id = str(row["run_id"])
        date = row["start_date_local"]
        distance_km = float(row["distance"]) / 1000
        print(
            f"新增预览 {date[:16]} / {distance_km:.2f} km / "
            f"{source_files[activity_id].name}"
        )
    if duplicates:
        print(f"重复文件 {duplicates} 条，不会重复写入")
    if conflicts:
        raise ValueError(
            "疑似跨来源重复，请核对后重试；未写入任何活动:\n" + "\n".join(conflicts)
        )
    if args.dry_run or not added:
        print("未改动活动数据")
        return
    if destination.read_bytes() != before:
        raise ValueError("导入期间活动数据已改变，请重新执行")
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", dir=destination.parent, delete=False
        ) as stream:
            temporary_path = Path(stream.name)
            json.dump(merged, stream, ensure_ascii=True, allow_nan=False)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary_path, destination)
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
    write_import_status(merged, added)
    print(f"已追加 {len(added)} 条活动: {destination}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"导入失败: {error}", file=sys.stderr)
        sys.exit(1)
