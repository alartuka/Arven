"use client";

import { Button } from '@/components/ui/button';
import { useRouter } from "next/navigation";

export default function Bot() {
    const { push } = useRouter();

    const handleButton = () => {
        push("/");
    };

  return (
    <div>
        <Button variant="outline" onClick={handleButton} className="position-absolute bottom-18px">
            Back
        </Button>
    </div>
  )
}
