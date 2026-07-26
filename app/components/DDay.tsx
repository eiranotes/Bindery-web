type DDayProps = {
  days: number;
  label?: string;
};

export function DDay({ days, label = "마감" }: DDayProps) {
  const value = days === 0 ? "D-DAY" : `D-${days}`;

  return (
    <span className="d-day" aria-label={`${label} ${value}`}>
      <span className="d-day__base">{value}</span>
      <span className="d-day__offset" aria-hidden="true">
        {value}
      </span>
    </span>
  );
}
