import React from "react";

import { TooltipContent, TooltipTrigger, Tooltip as TooltipUI } from "../ui/tooltip";

export type TooltipProps = React.ComponentProps<typeof TooltipTrigger> & {
  description?: string;
};

/**
 * A tooltip around one element — usually an icon button.
 *
 * The trigger is `asChild`, so the child stays the only button (no button nested in a button), and
 * every other prop is passed on to it. That is what lets this sit inside another `asChild` trigger,
 * e.g. `<DialogTrigger asChild><Tooltip>…</Tooltip></DialogTrigger>`: the dialog's onClick and ref
 * arrive here as props and have to reach the button, or the dialog never opens.
 */
function Tooltip({ children, description, ...props }: TooltipProps) {
  return (
    <TooltipUI>
      <TooltipTrigger asChild {...props}>
        {children}
      </TooltipTrigger>

      <TooltipContent>
        <p>{description}</p>
      </TooltipContent>
    </TooltipUI>
  );
}

export default Tooltip;
