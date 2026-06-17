import { useState } from 'react'
import Dashboard from './Dashboard'
import FoodsPage from './FoodsPage'
import { type NewFoodInput } from './AddFoodModal'

type Tab = 'dashboard' | 'foods'

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'foods', label: 'Foods' },
]

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  // Macros handed up from the Foods page, waiting to pre-fill the add-food modal.
  const [prefill, setPrefill] = useState<Partial<NewFoodInput> | null>(null)

  // Picking a reference food jumps to the dashboard and opens the modal pre-filled.
  const handleSelectFood = (values: Partial<NewFoodInput>) => {
    setPrefill(values)
    setActiveTab('dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <nav className="border-b border-slate-200 bg-white">
        <div
          role="tablist"
          aria-label="Sections"
          className="mx-auto flex max-w-5xl gap-1 px-4"
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium focus:outline-none ${
                  active
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Both panels stay mounted so the dashboard keeps its logged entries when
          the user browses Foods; `hidden` removes the inactive one from view. */}
      <div hidden={activeTab !== 'dashboard'}>
        <Dashboard prefill={prefill} onPrefillConsumed={() => setPrefill(null)} />
      </div>
      <div hidden={activeTab !== 'foods'}>
        <FoodsPage onSelectFood={handleSelectFood} />
      </div>
    </div>
  )
}

export default App
