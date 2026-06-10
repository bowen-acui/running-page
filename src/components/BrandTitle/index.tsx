interface BrandTitleProps {
  title: string;
  className?: string;
  prefixClassName?: string;
  suffixClassName?: string;
}

const RUNNING_SUFFIX = ' Running';

const joinClasses = (...classes: Array<string | undefined>) =>
  classes.filter(Boolean).join(' ');

const BrandTitle = ({
  title,
  className,
  prefixClassName,
  suffixClassName,
}: BrandTitleProps) => {
  const runningTitleIndex = title.indexOf(RUNNING_SUFFIX);
  const titlePrefix =
    runningTitleIndex >= 0 ? title.slice(0, runningTitleIndex) : title;
  const titleSuffix =
    runningTitleIndex >= 0 ? title.slice(runningTitleIndex + 1) : '';

  return (
    <span
      className={joinClasses(
        'inline-flex max-w-full items-baseline gap-[0.26em] leading-[0.96] whitespace-nowrap text-[color:var(--color-text-primary)]',
        className
      )}
    >
      <span
        className={joinClasses(
          'font-[family:var(--font-logo)] font-extrabold tracking-[0.008em]',
          prefixClassName
        )}
      >
        {titlePrefix}
      </span>
      {titleSuffix && (
        <span
          className={joinClasses(
            'relative top-[0.03em] text-[0.98em] font-[family:var(--font-logo-latin)] font-bold tracking-[0.01em] italic',
            suffixClassName
          )}
        >
          {titleSuffix}
        </span>
      )}
    </span>
  );
};

export default BrandTitle;
