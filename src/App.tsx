import { useState } from 'react'
import { DashboardView } from './Dashboard'
import FoodsPage from './FoodsPage'
import GoalsPage from './GoalsPage'
import WeeklyReport from './WeeklyReport'
import MonthlyReport from './MonthlyReport'
import { useFoodLog } from './useFoodLog'
import { type NewFoodInput } from './AddFoodModal'
import LogViewer from './LogViewer'

type Tab = 'dashboard' | 'foods' | 'goals' | 'weekly' | 'monthly'

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'foods', label: 'Foods' },
  { id: 'goals', label: 'Goals' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
]

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  // Macros handed up from the Foods page, waiting to pre-fill the add-food modal.
  const [prefill, setPrefill] = useState<Partial<NewFoodInput> | null>(null)
  // One shared food-log store for the whole app, so the dashboard reflects goal
  // changes made on the Goals tab (and vice versa) without a remount.
  const foodLog = useFoodLog()

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

      {/* All panels stay mounted so the dashboard keeps its logged entries when
          the user browses other tabs; `hidden` removes the inactive ones from
          view. They share one `foodLog` store, so a goal change is reflected
          everywhere immediately. */}
      <div hidden={activeTab !== 'dashboard'}>
        <DashboardView
          prefill={prefill}
          onPrefillConsumed={() => setPrefill(null)}
          loggedFoods={foodLog.entries}
          goalHistory={foodLog.goalHistory}
          weights={foodLog.weights}
          addEntry={foodLog.addEntry}
          addEntries={foodLog.addEntries}
          updateEntry={foodLog.updateEntry}
          deleteEntry={foodLog.deleteEntry}
          setWeight={foodLog.setWeight}
          fluids={foodLog.fluids}
          targetFluid={foodLog.targetFluid}
          addFluid={foodLog.addFluid}
          updateFluid={foodLog.updateFluid}
          deleteFluid={foodLog.deleteFluid}
        />
      </div>
      <div hidden={activeTab !== 'foods'}>
        <FoodsPage
          foods={foodLog.foods}
          onSelectFood={handleSelectFood}
          addFood={foodLog.addFood}
          updateFood={foodLog.updateFood}
          deleteFood={foodLog.deleteFood}
          addCategory={foodLog.addCategory}
          deleteCategory={foodLog.deleteCategory}
        />
      </div>
      <div hidden={activeTab !== 'goals'}>
        <GoalsPage
          goalHistory={foodLog.goalHistory}
          onAdd={foodLog.addGoalChange}
          onDelete={foodLog.deleteGoalChange}
          targetWeight={foodLog.targetWeight}
          onSetTargetWeight={foodLog.setTargetWeight}
          targetFluid={foodLog.targetFluid}
          onSetTargetFluid={foodLog.setTargetFluid}
        />
      </div>
      <div hidden={activeTab !== 'weekly'}>
        <WeeklyReport
          loggedFoods={foodLog.entries}
          goalHistory={foodLog.goalHistory}
          foods={foodLog.foods}
          weights={foodLog.weights}
          targetWeight={foodLog.targetWeight}
          fluids={foodLog.fluids}
          targetFluid={foodLog.targetFluid}
        />
      </div>
      <div hidden={activeTab !== 'monthly'}>
        <MonthlyReport
          loggedFoods={foodLog.entries}
          goalHistory={foodLog.goalHistory}
          weights={foodLog.weights}
          targetWeight={foodLog.targetWeight}
          fluids={foodLog.fluids}
          targetFluid={foodLog.targetFluid}
        />
      </div>

      {/* Always-visible floating launcher for the persisted event log. */}
      <LogViewer />
    </div>
  )
}

export default App
