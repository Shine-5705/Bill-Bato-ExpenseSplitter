import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

type Member = {
  id: string
  name: string
}

type Group = {
  id: string
  name: string
  members: Member[]
}

type Expense = {
  id: string
  groupId: string
  description: string
  amount: number
  paidByMemberId: string
  splitType: 'equal' | 'custom'
  participantIds: string[]
  shares: Record<string, number>
  category: string
  createdAt: string
}

type Settlement = {
  fromMemberId: string
  toMemberId: string
  amount: number
}

type PersistedState = {
  groups: Group[]
  expenses: Expense[]
  activeGroupId: string | null
}

const STORAGE_KEY = 'smart-expense-splitter-v1'

const seedState: PersistedState = {
  groups: [
    {
      id: 'grp-demo',
      name: 'Goa Trip',
      members: [
        { id: 'm-1', name: 'Aarav' },
        { id: 'm-2', name: 'Diya' },
        { id: 'm-3', name: 'Kabir' },
      ],
    },
  ],
  expenses: [
    {
      id: 'e-1',
      groupId: 'grp-demo',
      description: 'Dinner at beach shack',
      amount: 2400,
      paidByMemberId: 'm-1',
      splitType: 'equal',
      participantIds: ['m-1', 'm-2', 'm-3'],
      shares: {
        'm-1': 800,
        'm-2': 800,
        'm-3': 800,
      },
      category: 'Food',
      createdAt: new Date().toISOString(),
    },
  ],
  activeGroupId: 'grp-demo',
}

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

const money = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value)

const readPersistedState = (): PersistedState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return seedState
    }
    const parsed = JSON.parse(raw) as PersistedState
    if (!Array.isArray(parsed.groups) || !Array.isArray(parsed.expenses)) {
      return seedState
    }
    return parsed
  } catch {
    return seedState
  }
}

const categorizeExpense = (description: string): string => {
  const text = description.toLowerCase()
  if (/dinner|lunch|breakfast|food|cafe|restaurant|grocery/.test(text)) {
    return 'Food'
  }
  if (/flight|train|cab|taxi|uber|bus|fuel|petrol|travel/.test(text)) {
    return 'Travel'
  }
  if (/rent|stay|hotel|airbnb|hostel|room/.test(text)) {
    return 'Stay'
  }
  if (/movie|game|party|ticket|event|fun/.test(text)) {
    return 'Entertainment'
  }
  if (/wifi|internet|electricity|water|bill|utility/.test(text)) {
    return 'Utilities'
  }
  return 'Other'
}

const getWeekStart = (dateInput: string) => {
  const date = new Date(dateInput)
  const day = date.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const weekStart = new Date(date)
  weekStart.setDate(date.getDate() + diffToMonday)
  weekStart.setHours(0, 0, 0, 0)
  return weekStart
}

function App() {
  const [persisted] = useState<PersistedState>(readPersistedState)

  const [groups, setGroups] = useState<Group[]>(persisted.groups)
  const [expenses, setExpenses] = useState<Expense[]>(persisted.expenses)
  const [activeGroupId, setActiveGroupId] = useState<string | null>(
    persisted.activeGroupId,
  )

  const [groupName, setGroupName] = useState('')
  const [memberName, setMemberName] = useState('')

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [paidByMemberId, setPaidByMemberId] = useState('')
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal')
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [customShares, setCustomShares] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')

  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? null

  useEffect(() => {
    const nextState: PersistedState = {
      groups,
      expenses,
      activeGroupId,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
  }, [groups, expenses, activeGroupId])

  const defaultParticipantIds = useMemo(
    () => activeGroup?.members.map((member) => member.id) ?? [],
    [activeGroup],
  )

  const effectiveParticipantIds = participantIds.length
    ? participantIds
    : defaultParticipantIds

  const effectivePaidByMemberId =
    paidByMemberId && activeGroup?.members.some((member) => member.id === paidByMemberId)
      ? paidByMemberId
      : activeGroup?.members[0]?.id ?? ''

  const groupExpenses = useMemo(
    () => expenses.filter((expense) => expense.groupId === activeGroupId),
    [expenses, activeGroupId],
  )

  const balances = useMemo(() => {
    if (!activeGroup) {
      return {} as Record<string, number>
    }
    const map: Record<string, number> = Object.fromEntries(
      activeGroup.members.map((member) => [member.id, 0]),
    )
    for (const expense of groupExpenses) {
      map[expense.paidByMemberId] += expense.amount
      for (const [memberId, share] of Object.entries(expense.shares)) {
        map[memberId] -= share
      }
    }
    return map
  }, [activeGroup, groupExpenses])

  const settlements = useMemo<Settlement[]>(() => {
    if (!activeGroup) {
      return []
    }
    const creditors = activeGroup.members
      .map((member) => ({
        memberId: member.id,
        amount: Number((balances[member.id] ?? 0).toFixed(2)),
      }))
      .filter((entry) => entry.amount > 0.01)
      .sort((a, b) => b.amount - a.amount)

    const debtors = activeGroup.members
      .map((member) => ({
        memberId: member.id,
        amount: Number((Math.abs(balances[member.id] ?? 0)).toFixed(2)),
      }))
      .filter((entry) => balances[entry.memberId] < -0.01)
      .sort((a, b) => b.amount - a.amount)

    const simplified: Settlement[] = []
    let creditorIndex = 0
    let debtorIndex = 0

    while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
      const creditor = creditors[creditorIndex]
      const debtor = debtors[debtorIndex]
      const transfer = Number(Math.min(creditor.amount, debtor.amount).toFixed(2))
      if (transfer > 0) {
        simplified.push({
          fromMemberId: debtor.memberId,
          toMemberId: creditor.memberId,
          amount: transfer,
        })
      }
      creditor.amount = Number((creditor.amount - transfer).toFixed(2))
      debtor.amount = Number((debtor.amount - transfer).toFixed(2))
      if (creditor.amount <= 0.01) {
        creditorIndex += 1
      }
      if (debtor.amount <= 0.01) {
        debtorIndex += 1
      }
    }

    return simplified
  }, [activeGroup, balances])

  const insights = useMemo(() => {
    const now = new Date()
    const currentWeekStart = getWeekStart(now.toISOString())
    const previousWeekStart = new Date(currentWeekStart)
    previousWeekStart.setDate(previousWeekStart.getDate() - 7)

    const currentTotals: Record<string, number> = {}
    const previousTotals: Record<string, number> = {}

    for (const expense of groupExpenses) {
      const expenseWeek = getWeekStart(expense.createdAt)
      const category = expense.category
      if (expenseWeek.getTime() === currentWeekStart.getTime()) {
        currentTotals[category] = (currentTotals[category] ?? 0) + expense.amount
      } else if (expenseWeek.getTime() === previousWeekStart.getTime()) {
        previousTotals[category] = (previousTotals[category] ?? 0) + expense.amount
      }
    }

    const lines: string[] = []
    for (const [category, amountNow] of Object.entries(currentTotals)) {
      const amountBefore = previousTotals[category] ?? 0
      if (amountBefore > 0) {
        const deltaPercent = ((amountNow - amountBefore) / amountBefore) * 100
        const direction = deltaPercent >= 0 ? 'more' : 'less'
        lines.push(
          `${Math.abs(deltaPercent).toFixed(0)}% ${direction} spending on ${category} this week.`,
        )
      } else {
        lines.push(`New ${category.toLowerCase()} spend of ${money(amountNow)} this week.`)
      }
    }

    if (!lines.length && groupExpenses.length) {
      const byCategory = groupExpenses.reduce<Record<string, number>>((acc, expense) => {
        acc[expense.category] = (acc[expense.category] ?? 0) + expense.amount
        return acc
      }, {})
      const top = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]
      if (top) {
        lines.push(`Most spending so far is on ${top[0]} (${money(top[1])}).`)
      }
    }

    return lines
  }, [groupExpenses])

  const totalSpent = useMemo(
    () => groupExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [groupExpenses],
  )

  const addGroup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = groupName.trim()
    if (!trimmed) {
      return
    }
    const group: Group = {
      id: uid(),
      name: trimmed,
      members: [],
    }
    setGroups((current) => [...current, group])
    setActiveGroupId(group.id)
    setGroupName('')
  }

  const addMember = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeGroup) {
      return
    }
    const trimmed = memberName.trim()
    if (!trimmed) {
      return
    }
    setGroups((currentGroups) =>
      currentGroups.map((group) => {
        if (group.id !== activeGroup.id) {
          return group
        }
        const exists = group.members.some(
          (member) => member.name.toLowerCase() === trimmed.toLowerCase(),
        )
        if (exists) {
          return group
        }
        return {
          ...group,
          members: [...group.members, { id: uid(), name: trimmed }],
        }
      }),
    )
    setMemberName('')
  }

  const toggleParticipant = (memberId: string) => {
    setParticipantIds((current) => {
      const baseline = current.length ? current : defaultParticipantIds
      return baseline.includes(memberId)
        ? baseline.filter((id) => id !== memberId)
        : [...baseline, memberId]
    })
  }

  const addExpense = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError('')
    if (!activeGroup) {
      setFormError('Create a group first.')
      return
    }
    if (activeGroup.members.length < 2) {
      setFormError('Add at least 2 members to split expenses.')
      return
    }

    const trimmedDescription = description.trim()
    const parsedAmount = Number(amount)
    if (!trimmedDescription || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError('Enter a valid description and amount.')
      return
    }
    if (!effectivePaidByMemberId) {
      setFormError('Select who paid the expense.')
      return
    }
    if (!effectiveParticipantIds.length) {
      setFormError('Select at least one participant.')
      return
    }

    const shares: Record<string, number> = {}
    if (splitType === 'equal') {
      const perMember = parsedAmount / effectiveParticipantIds.length
      for (const memberId of effectiveParticipantIds) {
        shares[memberId] = Number(perMember.toFixed(2))
      }
      const correction = Number(
        (parsedAmount - Object.values(shares).reduce((sum, value) => sum + value, 0)).toFixed(2),
      )
      if (Math.abs(correction) > 0 && effectiveParticipantIds[0]) {
        shares[effectiveParticipantIds[0]] = Number(
          (shares[effectiveParticipantIds[0]] + correction).toFixed(2),
        )
      }
    } else {
      let customTotal = 0
      for (const memberId of effectiveParticipantIds) {
        const value = Number(customShares[memberId] ?? 0)
        if (!Number.isFinite(value) || value < 0) {
          setFormError('Custom shares must be valid positive numbers.')
          return
        }
        shares[memberId] = Number(value.toFixed(2))
        customTotal += shares[memberId]
      }
      if (Math.abs(customTotal - parsedAmount) > 0.01) {
        setFormError(`Custom shares must add up to ${money(parsedAmount)}.`)
        return
      }
    }

    const expense: Expense = {
      id: uid(),
      groupId: activeGroup.id,
      description: trimmedDescription,
      amount: Number(parsedAmount.toFixed(2)),
      paidByMemberId: effectivePaidByMemberId,
      splitType,
      participantIds: effectiveParticipantIds,
      shares,
      category: categorizeExpense(trimmedDescription),
      createdAt: new Date().toISOString(),
    }

    setExpenses((current) => [expense, ...current])
    setDescription('')
    setAmount('')
    setSplitType('equal')
    setCustomShares({})
  }

  const getMemberName = (memberId: string) =>
    activeGroup?.members.find((member) => member.id === memberId)?.name ?? 'Unknown'

  return (
    <div className="app-shell">
      <header className="hero-card">
        <p className="eyebrow">Smart Expense Splitter</p>
        <h1>Split faster. Settle fair. Stay friends.</h1>
        <p className="subtitle">
          Create groups, track shared expenses in real time, and auto-generate who owes whom.
        </p>
      </header>

      <main className="layout">
        <section className="panel stack">
          <h2>1. Groups & Members</h2>

          <form className="inline-form" onSubmit={addGroup}>
            <input
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="New group name"
            />
            <button type="submit">Create Group</button>
          </form>

          <div className="group-list">
            {groups.map((group) => (
              <button
                key={group.id}
                className={`group-pill ${group.id === activeGroupId ? 'active' : ''}`}
                onClick={() => setActiveGroupId(group.id)}
                type="button"
              >
                {group.name}
                <span>{group.members.length} members</span>
              </button>
            ))}
          </div>

          {activeGroup ? (
            <>
              <form className="inline-form" onSubmit={addMember}>
                <input
                  value={memberName}
                  onChange={(event) => setMemberName(event.target.value)}
                  placeholder="Add member"
                />
                <button type="submit">Add</button>
              </form>

              <div className="chips">
                {activeGroup.members.map((member) => (
                  <span key={member.id} className="chip">
                    {member.name}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="hint">Create a group to begin.</p>
          )}
        </section>

        <section className="panel stack">
          <h2>2. Add Expense</h2>
          <form className="stack" onSubmit={addExpense}>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Expense description"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Amount"
            />

            <select
              value={effectivePaidByMemberId}
              onChange={(event) => setPaidByMemberId(event.target.value)}
              disabled={!activeGroup?.members.length}
            >
              <option value="">Paid by...</option>
              {activeGroup?.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>

            <div className="switches">
              <label>
                <input
                  type="radio"
                  name="splitType"
                  checked={splitType === 'equal'}
                  onChange={() => setSplitType('equal')}
                />
                Equal split
              </label>
              <label>
                <input
                  type="radio"
                  name="splitType"
                  checked={splitType === 'custom'}
                  onChange={() => setSplitType('custom')}
                />
                Custom split
              </label>
            </div>

            <div className="participants">
              {activeGroup?.members.map((member) => {
                const selected = effectiveParticipantIds.includes(member.id)
                return (
                  <label key={member.id} className={`participant ${selected ? 'on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleParticipant(member.id)}
                    />
                    <span>{member.name}</span>
                    {splitType === 'custom' && selected ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="share-input"
                        value={customShares[member.id] ?? ''}
                        onChange={(event) =>
                          setCustomShares((current) => ({
                            ...current,
                            [member.id]: event.target.value,
                          }))
                        }
                        placeholder="Share"
                      />
                    ) : null}
                  </label>
                )
              })}
            </div>

            {formError ? <p className="error">{formError}</p> : null}
            <button type="submit">Add Expense</button>
          </form>
        </section>

        <section className="panel stack">
          <h2>3. Balances & Settlements</h2>
          <div className="metrics">
            <article>
              <p>Total spent</p>
              <strong>{money(totalSpent)}</strong>
            </article>
            <article>
              <p>Expenses logged</p>
              <strong>{groupExpenses.length}</strong>
            </article>
          </div>

          {activeGroup?.members.length ? (
            <ul className="balance-list">
              {activeGroup.members.map((member) => {
                const value = balances[member.id] ?? 0
                const status = value > 0.01 ? 'gets back' : value < -0.01 ? 'owes' : 'settled'
                return (
                  <li key={member.id}>
                    <span>{member.name}</span>
                    <span className={value >= 0 ? 'positive' : 'negative'}>
                      {status === 'settled' ? 'Settled' : `${status} ${money(Math.abs(value))}`}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="hint">Add members to compute balances.</p>
          )}

          <div className="settlements">
            <h3>Who owes whom</h3>
            {settlements.length ? (
              <ul>
                {settlements.map((item, index) => (
                  <li key={`${item.fromMemberId}-${item.toMemberId}-${index}`}>
                    <span>{getMemberName(item.fromMemberId)}</span>
                    <span>pays</span>
                    <span>{getMemberName(item.toMemberId)}</span>
                    <strong>{money(item.amount)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="hint">No pending settlements.</p>
            )}
          </div>
        </section>

        <section className="panel stack wide">
          <h2>4. Expense Feed & AI Insights</h2>
          <ul className="expense-list">
            {groupExpenses.map((expense) => (
              <li key={expense.id}>
                <div>
                  <strong>{expense.description}</strong>
                  <p>
                    Paid by {getMemberName(expense.paidByMemberId)} • {expense.category} •{' '}
                    {new Date(expense.createdAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <span>{money(expense.amount)}</span>
              </li>
            ))}
          </ul>

          <div className="insights">
            <h3>Smart spending insights</h3>
            {insights.length ? (
              <ul>
                {insights.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="hint">Add more expenses to unlock trend insights.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
