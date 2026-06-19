import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from 'recharts'

// Guards issue #57: the protein-source bar chart shows a value label at the end
// of every bar. Recharts drops a Bar's LabelList while the bar is animating, so
// the chart sets isAnimationActive={false}. This renders the same config against
// the REAL recharts (WeeklyReport.test mocks the library, so it can't catch
// this) at a fixed size so jsdom computes a layout and emits the label <text>.
const data = [
  { category: 'Meat/Poultry', share: 70 },
  { category: 'Dairy/Eggs', share: 20 },
  { category: 'Other', share: 10 },
]

function renderChart(isAnimationActive: boolean) {
  const { container } = render(
    <BarChart
      layout="vertical"
      width={500}
      height={300}
      data={data}
      margin={{ top: 4, right: 40, bottom: 4, left: 8 }}
    >
      <XAxis type="number" domain={[0, 100]} />
      <YAxis type="category" dataKey="category" width={110} />
      <Bar dataKey="share" isAnimationActive={isAnimationActive}>
        {data.map((d) => (
          <Cell key={d.category} fill="#dc2626" />
        ))}
        <LabelList dataKey="share" position="right" formatter={(v) => `${v}%`} />
      </Bar>
    </BarChart>,
  )
  return [...container.querySelectorAll('.recharts-label-list text')].map((t) => t.textContent)
}

describe('protein-source bar value labels', () => {
  it('paints a label for every bar when animation is disabled (the chart config)', () => {
    expect(renderChart(false)).toEqual(['70%', '20%', '10%'])
  })

  it('documents the bug: an animated bar drops its labels', () => {
    expect(renderChart(true)).toEqual([])
  })
})
