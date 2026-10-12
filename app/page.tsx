import { Hero } from "@/components/hero";
import { Projects } from "@/components/projects";
import { Skills } from "@/components/skills";
import { About } from "@/components/about";
import { Contact } from "@/components/contact";
import { Divider } from "@/components/section";

export default function Home() {
  return (
    <>
      <Hero />
      <Divider />
      <Projects />
      <Divider />
      <Skills />
      <Divider />
      <About />
      <Contact />
    </>
  );
}
