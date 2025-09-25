import React, { useState } from "react";
import "./styles.css";

const logins = [
  { usuario: "NovoShopping", loja: "NovoShopping", isAdmin: false },
  { usuario: "RibeiraoShopping", loja: "RibeiraoShopping", isAdmin: false },
  { usuario: "DomPedro", loja: "DomPedro", isAdmin: false },
  { usuario: "Iguatemi", loja: "Iguatemi", isAdmin: false },
  { usuario: "Admintrador", loja: "Administrador", isAdmin: true },
];

const senhaPadrao = "1234";
const senhaAdmin = "demo1234";

export default function App() {
  const [usuarioSelecionado, setUsuarioSelecionado] = useState("");
  const [senha, setSenha] = useState("");
  const [logado, setLogado] = useState(false);
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [erro, setErro] = useState("");

  const handleLogin = () => {
    const user = logins.find((u) => u.usuario === usuarioSelecionado);

    if (!user) {
      setErro("Usuário inválido!");
      return;
    }

    if (
      (!user.isAdmin && senha === senhaPadrao) ||
      (user.isAdmin && senha === senhaAdmin)
    ) {
      setLogado(true);
      setUsuarioLogado(user);
      setErro("");
    } else {
      setErro("Senha incorreta!");
    }
  };

  const handleLogout = () => {
    setLogado(false);
    setUsuarioLogado(null);
    setSenha("");
  };

  return (
    <>
      <div className="decorative-circle"></div>
      <div className="container">
        {!logado ? (
          <div className="login-box">
            <div className="login-header">
              <div className="icon">
                {/* SVG ícone de transferência */}
                <svg viewBox="0 0 22 22"><path d="M7 11h8m-8 0l3-3m-3 3l3 3" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
              </div>
              <h1>Painel de<br />Transferência</h1>
            </div>
            <div className="input-group">
              <div className="select-wrapper">
                <span className="select-icon">
                  {/* Ícone loja/usuário */}
                  <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M3 17c0-2.8 3.7-4.5 7-4.5s7 1.7 7 4.5" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
                </span>
                <select
                  value={usuarioSelecionado}
                  onChange={(e) => setUsuarioSelecionado(e.target.value)}
                >
                  <option value="">Selecione a Loja</option>
                  {logins.map((u) => (
                    <option key={u.usuario} value={u.usuario}>
                      {u.usuario}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-wrapper">
                <span className="input-icon">
                  {/* Ícone senha */}
                  <svg width="20" height="20" viewBox="0 0 20 20"><rect x="5" y="9" width="10" height="7" rx="2.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M10 9V6a2.5 2.5 0 1 0-5 0v3" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
                </span>
                <input
                  type="password"
                  placeholder="Digite a senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </div>
            </div>
            {erro && <p className="erro">{erro}</p>}
            <button onClick={handleLogin}>Entrar</button>
          </div>
        ) : (
          <div className="login-box">
            <h2>Bem-vindo, {usuarioLogado.loja}!</h2>
            {usuarioLogado.isAdmin ? (
              <p className="admin">Permissões de Administrador</p>
            ) : (
              <p className="normal">Usuário comum</p>
            )}
            <button className="logout" onClick={handleLogout}>
              Sair
            </button>
          </div>
        )}
      </div>
    </>
  );
}
