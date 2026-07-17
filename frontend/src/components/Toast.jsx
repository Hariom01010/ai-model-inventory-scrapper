import { useEffect, useState } from "react";

export default function Toast({ toast }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toast) return undefined;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast || !visible) return null;
  return <div className={`toast ${toast.isError ? "error" : ""}`}>{toast.message}</div>;
}
