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
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      {!logado ? (
        <div className="bg-white shadow-xl rounded-2xl p-8 w-96 text-center">
          <h1 className="text-2xl font-bold mb-6">Painel de Transferência</h1>

          <select
            value={usuarioSelecionado}
            onChange={(e) => setUsuarioSelecionado(e.target.value)}
            className="w-full border rounded-lg p-2 mb-4"
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
            className="w-full border rounded-lg p-2 mb-4"
          />

          {erro && <p className="text-red-500 text-sm mb-2">{erro}</p>}

          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Entrar
          </button>
        </div>
      ) : (
        <div className="bg-white shadow-xl rounded-2xl p-8 w-96 text-center">
          <h2 className="text-xl font-bold mb-4">
            Bem-vindo, {usuarioLogado.loja}!
          </h2>
          {usuarioLogado.isAdmin ? (
            <p className="text-green-600 font-semibold mb-4">
              Permissões de Administrador
            </p>
          ) : (
            <p className="text-gray-600 mb-4">Usuário comum</p>
          )}

          <button
            onClick={handleLogout}
            className="w-full bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition"
          >
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
