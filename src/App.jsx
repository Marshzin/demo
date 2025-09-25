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
    <div className="container">
      {!logado ? (
        <div className="login-box">
          <h1>Painel de Transferência</h1>

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

          <input
            type="password"
            placeholder="Digite a senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />

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
  );
}
