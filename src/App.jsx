body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: #f4f6f8;
}

.app-container {
  padding: 20px;
}

.header {
  background: #222;
  color: white;
  padding: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tabs {
  display: flex;
  gap: 15px;
  margin: 20px 0;
}

.tabs button {
  background: none;
  border: none;
  padding: 10px;
  cursor: pointer;
  font-size: 16px;
}

.tabs button.active {
  border-bottom: 2px solid #007bff;
  font-weight: bold;
}

.card {
  background: white;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th, .table td {
  padding: 10px;
  border: 1px solid #ddd;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  margin-left: 10px;
}

.btn-blue {
  background: #007bff;
  color: white;
}

.btn-red {
  background: #dc3545;
  color: white;
}

.login-container {
  text-align: center;
  margin-top: 120px;
}

.login-container select,
.login-container input {
  padding: 10px;
  margin: 10px 0;
  font-size: 16px;
}
