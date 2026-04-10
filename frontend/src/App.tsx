import { BrowserRouter, Routes, Route } from "react-router-dom";
import Principal from "./pages/Principal"; // Importa tu nueva página
import Login from "./pages/Login";
import Register from "./pages/Register";
import Recuperar from "./pages/Recuperar";
import ResetPassword from "./pages/ResetPassword";
import Catalogo from "./pages/Catalogo";
import Confirmado from "./pages/VerificarCodigo";
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ahora la raíz "/" muestra la tienda directamente */}
        <Route path="/" element={<Principal />} />
        <Route path="/catalogo" element={<Catalogo />} />
        {/* El login ahora vive en su propia ruta "/login" */}
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/registro" element={<Register />} />
        <Route path="/recuperar" element={<Recuperar />} />
        <Route path="/reset" element={<ResetPassword />} />
        <Route path="/verificar-codigo" element={<Confirmado />} />

        {/* Si alguien escribe cualquier cosa mal, lo mandamos al inicio */}
        <Route path="*" element={<Principal />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;