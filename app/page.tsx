import { Button } from "@/components/ui/button";
import DatePicker from "@/components/ui/date-picker";
import DateRangePicker from "@/components/ui/date-range-picker";
import { Input } from "@/components/ui/input";
import InputFormattedNumber from "@/components/ui/input-formatted-number";
import InputNumber from "@/components/ui/input-number";
import InputText from "@/components/ui/input-text";
import { Label } from "@/components/ui/label";

export default function Page() {
  return (
    <div className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">Project ready!</h1>
          <p>You may now add components and start building.</p>
          <p>We&apos;ve already added the button component for you.</p>
          <Button className="mt-2">Button</Button>
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          (Press <kbd>d</kbd> to toggle dark mode)
        </div>

        <Label isRequired>Username</Label>
        <Input placeholder="Username" />

        <InputText
          required
          label="Username"
          placeholder="Username"
          errorMessage="Username is required"
        />

        <InputNumber
          required
          hideStepper
          label="Amount"
          placeholder="0"
          min={0}
          step={1}
          startContent="Rp"
          errorMessage="Amount is required"
        />

        <InputFormattedNumber
          required
          label="Formatted amount"
          placeholder="0"
          startContent="Rp"
          defaultValue={1250000.5}
          // errorMessage="Formatted amount is required"
        />

        <DatePicker required label="Date" />

        <DateRangePicker
          required
          label="Period"
          dateFormat="dd MMM yyyy"
          placeholder="dd MMM yyyy"
        />
      </div>
    </div>
  );
}
