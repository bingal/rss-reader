import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="p-8">
        <h1 className="text-4xl font-bold mb-4">RSS Reader</h1>
        <p className="text-muted-foreground mb-4">
          Welcome to RSS Reader - A fast, comfortable RSS reader desktop app
        </p>
        <button
          onClick={() => setCount(count + 1)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Count: {count}
        </button>
      </div>
    </div>
  )
}

export default App
