import { intComma } from '@/utils/utils';

interface IStatProperties {
  value: string | number;
  description: string;
  className?: string;
  citySize?: number;
  onClick?: () => void;
}

const Stat = ({
  value,
  description,
  className = 'w-full pb-3',
  citySize,
  onClick,
}: IStatProperties) => {
  const valueSizeClass =
    citySize === 3
      ? 'text-2xl md:text-3xl'
      : citySize === 4
        ? 'text-3xl md:text-4xl'
        : 'text-4xl md:text-5xl';

  return (
    <div className={className} onClick={onClick}>
      <span className={`${valueSizeClass} block font-black italic leading-none tracking-tight`}>
        {intComma(value.toString())}
      </span>
      <span className="mt-1 block text-sm font-semibold italic text-[color:var(--color-run-date)] md:text-base">
        {description}
      </span>
    </div>
  );
};

export default Stat;
