import { useEffect, useState } from "react";
import { FaChevronDown } from "react-icons/fa";
import "../css/FlechaScroll.css";

function FlechaScroll() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const refrescar = () => {
      const doc = document.documentElement;
      const scrollable =
        Math.max(doc.scrollHeight, document.body?.scrollHeight || 0) -
        window.innerHeight;
      if (scrollable <= 40) {
        setVisible(false);
        return;
      }
      const footer = document.querySelector("footer");
      if (footer) {
        const rect = footer.getBoundingClientRect();
        const linea25 = rect.top + window.scrollY + rect.height * 0.25;
        setVisible(window.scrollY + window.innerHeight < linea25);
      } else {
        setVisible(window.scrollY < scrollable);
      }
    };
    refrescar();
    window.addEventListener("scroll", refrescar, { passive: true });
    window.addEventListener("resize", refrescar);
    const timer = setInterval(refrescar, 400);
    return () => {
      window.removeEventListener("scroll", refrescar);
      window.removeEventListener("resize", refrescar);
      clearInterval(timer);
    };
  }, []);

  const bajar = () => {
    window.scrollBy({
      top: window.innerHeight * 0.85,
      behavior: "smooth",
    });
  };

  return (
    <button
      type="button"
      className={`flecha-scroll${visible ? " flecha-scroll-visible" : ""}`}
      onClick={bajar}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      aria-label="Bajar y ver más contenido"
    >
      <FaChevronDown />
    </button>
  );
}

export default FlechaScroll;
