import React, { PropsWithChildren } from "react";

import { TooltipContent, TooltipTrigger, Tooltip as TooltipUI } from "../ui/tooltip";

export interface TooltipProps extends PropsWithChildren {
  description?: string;
}

function Tooltip({ children, description }: TooltipProps) {
  return (
    <TooltipUI>
      <TooltipTrigger>{children}</TooltipTrigger>

      <TooltipContent>
        <p>{description}</p>
      </TooltipContent>
    </TooltipUI>
  );
}

export default Tooltip;
