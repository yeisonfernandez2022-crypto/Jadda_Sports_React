const AdminFooter = () => (
  <footer
    style={{
      background: "#0f0f0f",
      borderTop: "1px solid #222",
      color: "#666",
      fontSize: "0.8rem",
      textAlign: "center",
      padding: "16px 24px",
      marginTop: "40px",
    }}
  >
    &copy; {new Date().getFullYear()} JADDA SPORTS — Panel Administrativo
  </footer>
);

export default AdminFooter;
