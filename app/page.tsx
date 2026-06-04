import { ArrowRightIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import DatePicker from "@/components/ui/date-picker";
import DateRangePicker from "@/components/ui/date-range-picker";
import { Input } from "@/components/ui/input";
import InputCheckbox from "@/components/ui/input-checkbox";
import InputCheckboxGroup from "@/components/ui/input-checkbox-group";
import InputFormattedNumber from "@/components/ui/input-formatted-number";
import InputNumber from "@/components/ui/input-number";
import InputSelect from "@/components/ui/input-select";
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
          <div className="mt-2 flex flex-wrap gap-2">
            <Button startContent={<PlusIcon />}>Create</Button>
            <Button endContent={<ArrowRightIcon />} variant="outline">
              Continue
            </Button>
            <Button isLoading loadingText="Saving...">
              Save
            </Button>
          </div>
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

        <InputSelect
          required
          label="Status"
          placeholder="Select status"
          defaultValue="active"
          options={[
            { label: "Active", value: "active" },
            { label: "Inactive", value: "inactive" },
            { label: "Archived", value: "archived", disabled: true },
          ]}
        />

        <InputCheckbox
          required
          label="Accept terms"
          description="You agree to the terms and privacy policy."
        />

        <InputCheckboxGroup
          required
          label="Permissions"
          description="Select one or more permissions."
          defaultValue={["read"]}
          options={[
            { label: "Create", value: "create" },
            { label: "Read", value: "read" },
            { label: "Update", value: "update" },
            { label: "Delete", value: "delete", disabled: true },
          ]}
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
