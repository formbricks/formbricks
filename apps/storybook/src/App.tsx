import { useState } from "react";
import "./App.css";

export const App = () => {
  const [count, setCount] = useState(0);

  return (
    <>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank"></a>
      </div>
      <h1 className="bg-orange-200 p-4 font-bold">Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>count is {count}</button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">Click on the Vite and React logos to learn more</p>
    </>
  );
};
