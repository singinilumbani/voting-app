import Image from 'next/image';

export default function Header() {
  return (
    <header className="bg-[#0072BC] text-white">
      <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
        <Image
          src="/NACSO.png"
          alt="NACSO logo"
          width={52}
          height={52}
          unoptimized
          className="rounded-full bg-white p-1"
        />
        <span className="text-lg font-medium tracking-wide">NACSO</span>
      </div>
    </header>
  );
}
