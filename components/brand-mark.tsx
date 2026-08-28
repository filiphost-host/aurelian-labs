import Image from "next/image";

export function BrandMark({ className = "", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <span className={`brand-mark ${className}`.trim()} aria-hidden="true">
      <Image
        className="brand-mark-image"
        src="/aurelian-capital-mark.png"
        alt=""
        width={192}
        height={192}
        priority={priority}
        sizes="112px"
      />
    </span>
  );
}
