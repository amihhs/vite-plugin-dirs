import './style.css'

const app = document.getElementById('app')!

const settled = import.meta.dirs('/src', { exhaustive: false })

app.textContent = JSON.stringify(settled, null, 2)
