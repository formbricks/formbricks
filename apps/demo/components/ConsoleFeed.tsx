// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import { Console, Hook, Unhook } from "console-feed";

const LogsContainer = () => {
  const [logs, setLogs] = useState([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // run once!
  useEffect(() => {
    const hookedConsole = Hook(window.console, (log) => setLogs((currLogs) => [...currLogs, log]), false);
    return () => Unhook(hookedConsole);
  }, []);

  useEffect(scrollToBottom, [logs]);

  return (
    <>
      <Console logs={logs} variant="light" />
      <div ref={messagesEndRef} />
    </>
  );
};

export { LogsContainer };
