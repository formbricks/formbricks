"use client";

import React from "react";

interface WalletTokensProps {
  tokenCount?: number;
}

export function WalletTokens({ tokenCount }: WalletTokensProps): React.JSX.Element {
  return (
    <div className="flex items-center">
      <p className="text-primary text-4xl font-bold">{tokenCount}</p>
    </div>
  );
}

export default WalletTokens;
