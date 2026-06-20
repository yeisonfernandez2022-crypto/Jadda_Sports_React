import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import "../css/categorias.css";

function Categorias() {

    const navigate = useNavigate();

    const categorias = [
    {
        nombre: "Fútbol",
        imagen: "https://images.unsplash.com/photo-1574629810360-7efbbe195018"
    },
    {
        nombre: "Baloncesto",
        imagen: "https://images.unsplash.com/photo-1546519638-68e109498ffc"
    },
    {
        nombre: "Running",
        imagen: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5"
    },
    {
        nombre: "Gimnasio",
        imagen: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438"
    },
    {
        nombre: "Natación",
        imagen: "https://images.unsplash.com/photo-1519315901367-f34ff9154487"
    },
    {
        nombre: "Ciclismo",
        imagen: "https://images.unsplash.com/photo-1507035895480-2b3156c31fc8"
    },
    {
        nombre: "Deportes extremos",
        imagen: "https://images.unsplash.com/photo-1517649763962-0c623066013b"
    },
    {
        nombre: "Ropa deportiva",
        imagen: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f"
    },
    {
        nombre: "Accesorios",
        imagen: "https://images.unsplash.com/photo-1518611012118-696072aa579a"
    },
    {
        nombre: "Protección",
        imagen: "https://images.unsplash.com/photo-1511886929837-354d827aae26"
    },
    {
        nombre: "Cardio",
        imagen: "https://images.unsplash.com/photo-1517963879433-6ad2b056d712"
    },
    {
        nombre: "Hogar fitness",
        imagen: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b"
    },
    {
        nombre: "Suplementos",
        imagen: "https://images.unsplash.com/photo-1593095948071-474c5cc2989d"
    },
    {
        nombre: "Tecnología deportiva",
        imagen: "https://images.unsplash.com/photo-1510017803434-a899398421b3"
    },
    {
        nombre: "Ofertas",
        imagen: "https://images.unsplash.com/photo-1556740749-887f6717d7e4"
    }
];

    return (
        <>
            <Navbar />

            <div className="categorias-container">

                <section className="banner-categorias">

                    <h1>CATEGORÍAS</h1>

                    <p>
                        Encuentra productos para cada disciplina
                    </p>

                </section>

                <h2 className="explorar-titulo">
                    Explora por categoría
                </h2>

                <div className="categorias-grid">

                    {categorias.map((categoria) => (

                        <div
                            key={categoria.nombre}
                            className="categoria-card"
                            onClick={() =>
                                navigate(`/catalogo?categoria=${encodeURIComponent(categoria.nombre)}`)
                            }
                        >

                            <img
                                src={categoria.imagen}
                                alt={categoria.nombre}
                                loading="lazy"
                                onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x400?text=JADDA'; }}
                            />

                            <div className="overlay">

                                <h3>
                                    {categoria.nombre}
                                </h3>

                            </div>

                        </div>

                    ))}

                </div>

            </div>
        </>
    );
}

export default Categorias;