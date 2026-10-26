import { Button } from "@/components/ui/button";

const Page = () => (
  <div className="flex min-h-svh p-6">
    <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
      <div>
        <h1 className="font-medium">Project ready!</h1>
        <p>You may now add components and start building.</p>
        <Button className="mt-2">Button</Button>
      </div>
    </div>
  </div>
);

export default Page;
