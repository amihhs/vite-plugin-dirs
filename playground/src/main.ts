import './style.css'

const app = document.getElementById('app')!

const settled = import.meta.dirs('/src', { exhaustive: true })

app.textContent = JSON.stringify(settled, null, 2)
