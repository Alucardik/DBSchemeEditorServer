// Functional Dependency: LHS → RHS (LHS - determinant attributes, RHS - dependent attributes)
import { TableDependency } from "@/models/scheme"
import type { Optional } from "@/utils/optional"

interface FD {
    lhs: Set<string>
    rhs: Set<string>
}

export class DependencyMatrix {
    private readonly rows: FD[]
    private canonizedRows: FD[]
    private attrList: string[] = []

    constructor(dependencies: TableDependency[] = []) {
        this.rows = []
        this.canonizedRows = []

        for (const dependency of dependencies) {
            this.rows.push({
                lhs: new Set(dependency.determinants),
                rhs: new Set(dependency.dependants),
            })
        }
    }

    /**
     * Return the set of all attributes in matrix, sorted alphabetically
     * (either in LHS or RHS of any FD)
     */
    GetAllAttributes(): ReadonlyArray<string> {
        if (this.attrList.length > 0) {
            return this.attrList
        }

        const attrs = new Set<string>()
        for (const { lhs, rhs } of this.rows) {
            for (const a of lhs) attrs.add(a)
            for (const a of rhs) attrs.add(a)
        }

        this.attrList = Array.from(attrs.values()).toSorted()

        return this.attrList
    }


    // Follows the inner canonized row order of the matrix
    //  - need to call 'Canonize' first
    GetCanonizedDeterminantsCountPerRow(): number[] {
        return this.canonizedRows.map(r => r.lhs.size)
    }

    // Returns the number of times each attribute appear as determinant among all dependencies
    //  the array follows GetAllAttributes attribute order
    GetCanonizedDeterminantOrderPerAttribute(): number[] {
        const attrs = this.GetAllAttributes()
        const ret = new Array(attrs.length).fill(0)
        const attrOrderMapping = new Map<string, number>()
        for (const [i, a] of attrs.entries()) {
            attrOrderMapping.set(a, i)
        }

        for (const { lhs } of this.canonizedRows) {
            for (const a of lhs) {
                const attrIndex = attrOrderMapping.get(a)
                if (attrIndex) {
                    ret[attrIndex] += 1
                }
            }
        }

        return ret
    }

    // GetCanonizedMatrixValue returns:
    //  1 – if the requested attribute is in the lhs of the requested row
    //  0 – if the requested attribute is in the rhs of the requested row
    // null - otherwise
    GetCanonizedMatrixValue(this: DependencyMatrix, rowIndex: number, colIndex: number): Optional<number> {
        if (this.canonizedRows.length <= rowIndex) {
            return null
        }

        const attrs = this.GetAllAttributes()
        if (attrs.length <= colIndex) {
            return null
        }

        const attrName = attrs[colIndex]
        if (this.canonizedRows[rowIndex].lhs.has(attrName)) {
            return 1
        }

        if (this.canonizedRows[rowIndex].rhs.has(attrName)) {
            return 0
        }

        return null
    }

    GetCanonizedRow(this: DependencyMatrix, rowIndex: number): Optional<FD> {
        if (this.canonizedRows.length <= rowIndex) {
            return null
        }

        return this.canonizedRows[rowIndex]
    }

    GetCanonizedRows(this: DependencyMatrix): ReadonlyArray<FD> {
        return this.canonizedRows
    }

    MergePseudoTransitiveCanonicalRows(this: DependencyMatrix, attrRow: number, attrValue: 1 | 0): number {
        const rowIndicesToRemove = new Set<number>()

        if (this.canonizedRows.length <= attrRow) {
            return 0
        }

        const dep = this.canonizedRows[attrRow]
        const initialDepRHS = Array.from(dep.rhs.values()).sort()
        // move all dependent attributes from pseudo transitive rows to the currDependency rhs
        for (const attr of initialDepRHS) {
            const pseudoTransitiveRows = this.GetPseudoTransitiveCanonicalRowsByAttribute(attrRow, attr, attrValue)
            for (const [row, rowIndex] of pseudoTransitiveRows) {
                console.log("adding rhs from", rowIndex, row)
                for (const attr of row.rhs) {
                    if (!dep.lhs.has(attr)) {
                        dep.rhs.add(attr)
                    }
                }

                rowIndicesToRemove.add(rowIndex)
            }
        }

        // filter out all pseudo transitive rows
        this.canonizedRows = this.canonizedRows.filter((_, index) => !rowIndicesToRemove.has(index))

        return rowIndicesToRemove.size
    }

    GetPseudoTransitiveCanonicalRowsByAttribute(this: DependencyMatrix, attrRow: number, attrName: string, attrValue: 1 | 0): [FD, number][] {
        const ret = [] as [FD, number][]
        console.log("Checking pseudo transitivity by attr", attrName)

        for (const [i, row] of this.canonizedRows.entries()) {
            if (i === attrRow) {
                continue
            }

            if (attrValue === 0 && row.lhs.has(attrName)) {
                ret.push([row, i])
            }

            if (attrValue === 1 && row.rhs.has(attrName)) {
                ret.push([row, i])
            }
        }

        return ret
    }

    MergeIdenticalDeterminantRows(this: DependencyMatrix): number {
        const mergedDeterminants = new Set<string>()
        const rowIndicesToRemove = new Set<number>()

        for (const [i, row] of this.canonizedRows.entries()) {
            const lhsKey = Array.from(row.lhs.values()).sort().join("_")
            if (mergedDeterminants.has(lhsKey)) {
                continue
            }

            for (const [j, innerRow] of this.canonizedRows.entries()) {
                if (j === i) {
                    continue
                }

                const innerLHSKey = Array.from(innerRow.lhs.values()).sort().join("_")
                if (mergedDeterminants.has(innerLHSKey)) {
                    continue
                }

                // merge rows with the same lhs
                if (lhsKey === innerLHSKey) {
                    row.rhs = row.rhs.union(innerRow.rhs)
                    rowIndicesToRemove.add(j)
                }
            }

            mergedDeterminants.add(lhsKey)
        }

        // filter out all merged rows
        this.canonizedRows = this.canonizedRows.filter((_, index) => !rowIndicesToRemove.has(index))

        console.log("merged", this.ToString())

        return rowIndicesToRemove.size
    }

    // RemoveDuplicatedDependants checks each fd's lhs for being part of another fd's lhs
    //  and returns the relationships between moved attributes
    // [
    //      [[some of row 0 lhs attrNames]; number of row, which lhs is subset of row's 0 lhs (i.e. fk)],
    // ]
    RemoveDuplicatedDependants(this: DependencyMatrix): [string[], number][][] {
        const ret = new Array(this.canonizedRows.length) as [string[], number][][]
        for (let i = 0; i < this.canonizedRows.length; ++i) {
            ret[i] = []
        }

        for (const [i, row] of this.canonizedRows.entries()) {
            for (const [j, innerRow] of this.canonizedRows.entries()) {
                if (j === i) {
                    continue
                }

                // overlapping lhs parts require us to remove rhs parts from superset
                if (row.lhs.isSubsetOf(innerRow.lhs)) {
                    innerRow.rhs = innerRow.rhs.difference(row.rhs)
                    ret[j].push([Array.from(row.lhs.values()), i])
                }
            }
        }

        return ret
    }

    ToSecondNormalForm(this: DependencyMatrix): [string[], number][][] {
        this.FindMinimalCover()

        let rowIndexToStart = 0

        // we select first row in (max ccount, min rcount) manner, going through each rcount in ascending order (ccount is fixed)
        const colCountsMaxIndices = this.GetMaxCCountColumnIndices()
        const rowCountsIndicesAscending = this.GetRowIndicesAscendingByRCount()

        for (const colIndex of colCountsMaxIndices) {
            for (let i = 0; i < rowCountsIndicesAscending.length; i++) {
                if (this.GetCanonizedMatrixValue(rowCountsIndicesAscending[i], colIndex) === 1) {
                    rowIndexToStart = rowCountsIndicesAscending[i]
                    break
                }
            }
        }

        console.log("Selected row", rowIndexToStart, "first", this.GetCanonizedRow(rowIndexToStart))

        let currRowIndex = rowIndexToStart

        while (true) {
            const rowsMerged = this.MergePseudoTransitiveCanonicalRows(currRowIndex, 0)
            if (rowsMerged <= 0) {
                // we end the cycle as soon, as no rows have been merged
                break
            }

            console.log("Merged", rowsMerged, "by pseudo transitivity fdMatrix\n", this.ToString())

            const rowCountsMaxIndices = this.GetMaxRCountRowsIndices()
            const colCountsIndicesAscending = this.GetColumnIndicesAscendingByCCount()

            for (const rowIndex of rowCountsMaxIndices) {
                for (let i = 0; i < colCountsIndicesAscending.length; i++) {
                    if (this.GetCanonizedMatrixValue(rowIndex, colCountsIndicesAscending[i]) === 1) {
                        // check that the selected row has at least one pseudo transitive attribute
                        if (!this.HasPseudoTransitiveRHS(rowIndex)) {
                            continue
                        }

                        currRowIndex = rowIndex
                        break
                    }
                }
            }

            console.log("Selected", currRowIndex, "next", this.GetCanonizedRow(currRowIndex))
        }

        this.MergeIdenticalDeterminantRows()
        console.log("Merged by identical rows fdMatrix\n", this.ToString())

        const ret = this.RemoveDuplicatedDependants()
        console.log("Removed duplicated dependants fdMatrix\n", this.ToString())

        return ret
    }

    ToThirdNormalForm(this: DependencyMatrix): [string[], number][][] {
        this.FindMinimalCover()
        this.MergeIdenticalDeterminantRows()

        let rowIndexToStart = 0

        // we select first row in (max rcount, min ccount) manner, going through each ccount in ascending order (rcount is fixed)
        const rowCountsMaxIndices = this.GetMaxRCountRowsIndices()
        const colCountsIndicesAscending = this.GetColumnIndicesAscendingByCCount()

        const ret = new Array(this.canonizedRows.length) as [string[], number][][]
        for (let i = 0; i < this.canonizedRows.length; ++i) {
            ret[i] = []
        }

        for (const rowIndex of rowCountsMaxIndices) {
            for (let i = 0; i < colCountsIndicesAscending.length; i++) {
                if (this.GetCanonizedMatrixValue(rowIndex, colCountsIndicesAscending[i]) === 1) {
                    // check that the selected row has at least one pseudo transitive attribute
                    if (!this.HasPseudoTransitiveRHS(rowIndex)) {
                        continue
                    }

                    rowIndexToStart = rowIndex
                    break
                }
            }
        }

        console.log("Selected row", rowIndexToStart, "first", this.GetCanonizedRow(rowIndexToStart))

        const rowTraverseOrder = [rowIndexToStart, ...(this.canonizedRows.map((_, i) => i).filter(idx => idx !== rowIndexToStart))]
        for (const i of rowTraverseOrder) {
            console.log("Selected", i, "next", this.GetCanonizedRow(i))
            this.FollowPseudoTransitivePath(ret, i, i, new Set<number>())
            console.log("Matrix after path following", this.ToString())
        }

        return ret
    }

    ToStringInitialRows(this: DependencyMatrix): string {
        return this.rows
            .map(
                (r, i) =>
                    `${i}: {${[...r.lhs].join(', ')}} → {${[...r.rhs].join(', ')}}`
            )
            .join('\n');
    }

    /** Debug-only */
    ToString(this: DependencyMatrix): string {
        return this.canonizedRows
            .map(
                (r, i) =>
                    `${i}: {${[...r.lhs].join(', ')}} → {${[...r.rhs].join(', ')}}`
            )
            .join('\n');
    }

    private FindMinimalCover(this: DependencyMatrix): void {
        console.log("Initial fdMatrix\n", this.ToStringInitialRows())

        this.canonizedRows = []

        // split rhs by attribute
        for (const dependency of this.rows) {
            if (dependency.rhs.size === 0) {
                continue
            }

            if (dependency.rhs.size === 1) {
                this.canonizedRows.push(dependency)
                continue
            }

            // make rhs of size 1 each
            for (const attr of dependency.rhs) {
                this.canonizedRows.push({
                    lhs: dependency.lhs,
                    rhs: new Set([attr]),
                })
            }
        }

        console.log("fdMatrix split by rhs:\n", this.ToString())


        // FIXME: rather breaks on some cases
        // eliminate extraneous lhs attributes
        //  (for each row, for each attr in lhs try to remove this attr and check if rhs still holds)
        // for (const [rowIndex, row] of this.canonizedRows.entries()) {
        //     const removedAttrs = new Set<string>()
        //     for (const attr of row.lhs) {
        //         const testLHS = new Set(row.lhs.difference(removedAttrs))
        //         testLHS.delete(attr)
        //
        //         // build a temp FD list without current fd, but with the smaller LHS
        //         const testFDs = this.canonizedRows.filter((_, i) => i !== rowIndex)
        //
        //         // if rhs is still in closure of testLHS, 'attr' is extraneous
        //         const testClosure = this.Closure(testLHS, testFDs)
        //
        //         if (row.rhs.values().every(attr => testClosure.has(attr))) {
        //             removedAttrs.add(attr)
        //         }
        //     }
        //
        //     if (removedAttrs.size > 0) {
        //         row.lhs = row.lhs.difference(removedAttrs)
        //     }
        // }

        // console.log("fdMatrix with filtered lhs\n", this.ToString())

        // FIXME: use methodology from here: https://www.researchgate.net/publication/258493834_Minimization_of_Functional_Dependencies
        // remove redundant FDs
        const removedIndices = new Set<number>()
        // for (const [i, fd] of this.canonizedRows.entries()) {
        //     // we do no take current row into account as well as all previously deleted rows
        //     const temp = this.canonizedRows.filter(((_, j) => j !== i && !removedIndices.has(j)))
        //     // if A ∉ closure(X) under temp, then fd is required
        //     // we also assume, that each rhs size is 1, since we have split it up earlier
        //
        //     if (this.Closure(fd.lhs, temp).has([...fd.rhs][0])) {
        //         removedIndices.add(i)
        //     }
        // }

        console.log("try to remove indices", removedIndices)

        this.canonizedRows = this.canonizedRows.filter((_, i) => !removedIndices.has(i))

        console.log("Canonized fdMatrix\n", this.ToString())
    }

    private HasPseudoTransitiveRHS(this: DependencyMatrix, rowIndex: number): boolean {
        if (rowIndex >= this.canonizedRows.length) {
            return false
        }

        const rhs = this.canonizedRows[rowIndex].rhs

        for (const attr of rhs) {
            const hasPseudoTransitiveRHS = this.canonizedRows.some((fd, i) => {
                // skip current row
                if (i === rowIndex) {
                    return false
                }

                return fd.lhs.has(attr)
            })

            if (hasPseudoTransitiveRHS) {
                return true
            }
        }

        return false
    }

    private FollowPseudoTransitivePath(this: DependencyMatrix, relations: [string[], number][][], startRow: number, currRow: number, prevRows: Set<number>): [] {
        for (const attrName of this.canonizedRows[currRow].rhs) {
            // we erase dependencies only if we are not currently in the startRow
            if (startRow !== currRow) {
                if (this.canonizedRows[startRow].rhs.has(attrName)) {
                    // in case there is pseudo-transitive link we add a foreign key from the startRow's lhs to the current row's lhs
                    console.log("adding fk", [Array.from(this.canonizedRows[currRow].lhs.values()), currRow])
                    relations[startRow].push([Array.from(this.canonizedRows[currRow].lhs.values()), currRow])
                    this.canonizedRows[startRow].rhs.delete(attrName)
                }
            }

            for (const [i, row] of this.canonizedRows.entries()) {
                // we do not follow links trough start row or already visited rows
                if (i === startRow || prevRows.has(i)) {
                    continue
                }

                if (row.lhs.has(attrName)) {
                    prevRows.add(currRow)
                    this.FollowPseudoTransitivePath(relations, startRow, i, prevRows)
                }
            }
        }
    }

    /**
     * Computes  closure({attrs}) based on current FD rows.
     * Principle: while closure enlarges,
     *   for every FD(X→A), if X⊆closure, then add A. (as dependent attribute)
     */
    private Closure(this: DependencyMatrix, attrs: Set<string>, fds: FD[]): Set<string> {
        // TODO: could use extensive memoization
        const closure = new Set<string>(attrs)
        let changed = true

        while (changed) {
            changed = false
            for (const { lhs, rhs } of fds) {
                // if lhs ⊆ closure
                if (lhs.values().every(a => closure.has(a))) {
                    // добавляем rhs
                    for (const a of rhs) {
                        if (!closure.has(a)) {
                            closure.add(a)
                            changed = true
                        }
                    }
                }
            }

            if (!changed) {
                break
            }
        }

        return closure
    }

    private GetMaxRCountRowsIndices(this: DependencyMatrix) {
        const maxRowIndices = [] as number[]
        const rowCounts = this.GetCanonizedDeterminantsCountPerRow()
        const maxRCount = rowCounts.reduce((maxRCount, currCount) => Math.max(maxRCount, currCount), 0)

        rowCounts.forEach((rowCount, rowIndex) => {
            if (rowCount === maxRCount) {
                maxRowIndices.push(rowIndex)
            }
        })

        return maxRowIndices
    }

    private GetRowIndicesAscendingByRCount(this: DependencyMatrix) {
        const rowCounts = this.GetCanonizedDeterminantsCountPerRow()
        return rowCounts.map((_, idx)  => idx).toSorted((a, b) => rowCounts[a] - rowCounts[b])
    }

    private GetMaxCCountColumnIndices(this: DependencyMatrix) {
        const maxColumnIndices = [] as number[]
        const colCounts = this.GetCanonizedDeterminantOrderPerAttribute()
        const maxCCount = colCounts.reduce((maxCCount, currCount) => Math.max(maxCCount, currCount), 0)

        colCounts.forEach((colCount, rowIndex) => {
            if (colCount === maxCCount) {
                maxColumnIndices.push(rowIndex)
            }
        })

        return maxColumnIndices
    }

    private GetColumnIndicesAscendingByCCount(this: DependencyMatrix) {
        const columnCounts = this.GetCanonizedDeterminantOrderPerAttribute()
        return columnCounts.map((_, idx)  => idx).toSorted((a, b) => columnCounts[a] - columnCounts[b])
    }
}