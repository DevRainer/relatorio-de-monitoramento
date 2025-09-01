




document.getElementById("loginForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const message = document.getElementById("message");

  // Lista de usuários válidos
  const users = [
    { user: "admin", pass: "1234" },
    { user: "rainer", pass: "senha01" },
    { user: "joana", pass: "abc123" },
    { user: "carlos", pass: "pass456" },
    { user: "maria", pass: "m@r1a" },
    { user: "lucas", pass: "lucas789" },
    { user: "ana", pass: "an@senha" },
    { user: "pedro", pass: "pedro321" },
    { user: "juliana", pass: "jul!2025" }
  ];

  // Verifica se o usuário e senha existem
  const isValid = users.some(u => u.user === username && u.pass === password);

  if (isValid) {
    window.location.href = "report.html";
  } else {
    message.textContent = "Usuário ou senha inválidos.";
    message.style.color = "red";
    message.style.fontSize = "12px"
  }
});

