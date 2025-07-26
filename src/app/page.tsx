"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";


export default function Home() {
  const { push } = useRouter();

  const handleButton = () => {
    push("/bot");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-between p-4 height-100vh">
      {/* button should be closer to the buttom of the screen
       */}
       <main className="flex flex-col items-center justify-center flex-2 text-center">
          <Button variant="outline" onClick={handleButton} className="position-absolute bottom-18px">Talk to Arven</Button>
          <p className="text-sm mt-4 whitespace-nowrap overflow-hidden text-overflow: ellipsis">
            <a
              className="flex items-center gap-2 text-sm font-mono underline inline-flex"
              href="https://aven.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Aven&apos;s
            </a>
            {' '}Customer Support Agent&nbsp;designed to help you with your queries and tasks
          </p>
       </main>

      <footer className="flex flex-wrap items-center justify-center">
        &copy; {new Date().getFullYear()}&nbsp;
        <a
          className="flex items-center gap-2 text-sm/6 font-mono"
          href=""
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "underline" }}
        >
          Arven
        </a>
        &nbsp;Made by&nbsp;
        <a
          className="flex items-center gap-2 text-sm/6 font-mono"
          href="https://tuka-alsharief.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "underline" }}
        >
          Tuka Alsharief
        </a>
      </footer>

    </div>
  );
}
