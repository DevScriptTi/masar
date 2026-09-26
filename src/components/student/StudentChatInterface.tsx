"use client";

import React from "react";
import {
  DirectChatInterface,
  DirectChatInterfaceProps,
  Teacher,
} from "./DirectChatInterface";

export { DirectChatInterface };
export type { DirectChatInterfaceProps, Teacher };

export function StudentChatInterface(props: DirectChatInterfaceProps) {
  return <DirectChatInterface {...props} />;
}

export default StudentChatInterface;
