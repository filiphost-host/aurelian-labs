import Image from "next/image";

export function BrandMark({ className = "", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <span className={`brand-mark ${className}`.trim()} aria-hidden="true">
      <Image
        className="brand-mark-image"
        src="/aurelian-capital-mark.png"
        alt=""
        width={96}
        height={96}
        priority={priority}
        sizes="96px"
      />
    </span>
  );
}
