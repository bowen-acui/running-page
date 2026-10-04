#!/bin/zsh

set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
staging_dir="$(mktemp -d "${TMPDIR:-/tmp}/running-gpx.XXXXXX")"
trap 'rm -rf "$staging_dir"' EXIT

selected_files="$(osascript -l JavaScript \
  -e 'var app = Application.currentApplication(); app.includeStandardAdditions = true;' \
  -e 'var chosenFiles = app.chooseFile({ withPrompt: "选择要导入的 GPX 跑步轨迹", ofType: ["gpx"], multipleSelectionsAllowed: true });' \
  -e 'chosenFiles.map(function (file) { return file.toString(); }).join("\n");' \
)" || exit 0

if [[ -z "$selected_files" ]]; then
  print "未选择 GPX 文件。"
  exit 0
fi

file_index=0
while IFS= read -r file_path; do
  [[ -z "$file_path" ]] && continue
  if [[ "${file_path:l}" != *.gpx ]]; then
    print -u2 "所选文件不是 .gpx：$file_path"
    exit 1
  fi
  ((file_index += 1))
  cp "$file_path" "$staging_dir/${file_index}-${file_path:t:r}.gpx"
done <<< "$selected_files"

cd "$project_root"
python_bin="python3"
[[ -x .venv/bin/python ]] && python_bin=".venv/bin/python"
"$python_bin" run_page/import_incremental_gpx.py "$staging_dir" --dry-run

if ! osascript -e 'display dialog "预览无冲突。确认将新增活动写入 activities.json 并刷新 SVG 统计？" buttons {"取消", "导入"} default button "导入"'; then
  print "已取消，活动数据未改动。"
  exit 0
fi

"$python_bin" run_page/import_incremental_gpx.py "$staging_dir"
node scripts/refresh-svg-stats.mjs
git diff --stat -- src/static/activities.json src/static/data-status.json assets
print "导入已写入本地仓库；提交并发布后网站才会更新。"
read "?按回车关闭窗口。"
