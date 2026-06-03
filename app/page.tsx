import AgeGate from "@/components/AgeGate";
import Hero from "@/components/Hero";
import SiteFooter from "@/components/SiteFooter";

export default function Home() {
  return (
    <>
      <AgeGate />
      <main className="flex flex-1 flex-col">
        <Hero />
      </main>
      <SiteFooter />
    </>
  );
}
