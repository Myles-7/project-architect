import { BaseContextProfile } from './BaseContextProfile.js';
export class ReadinessContext extends BaseContextProfile {
    build(snapshot, payload) {
        const sections = [];
        // 1. Header
        sections.push(this.renderProjectHeader(snapshot, 'Readiness & Document Compilation Review'));
        // 2. Full Overview Section Maturity
        const overviewList = snapshot.overview.sections
            .map((s) => {
            const items = s.itemRefs
                .map((ref) => {
                const id = ref.replace(/^decision:/, '');
                const dec = snapshot.decisions.items.find((d) => d.id === id);
                return dec ? `- ${dec.statement}` : '';
            })
                .filter(Boolean)
                .join('\n');
            return `### ${s.title} (${s.id}) [Maturity: ${s.maturity.toUpperCase()}]\n${items || '(No confirmed statements yet)'}`;
        })
            .join('\n\n');
        sections.push(`## Comprehensive Overview Sections\n${overviewList}`);
        // 3. Confirmed & Locked Decisions
        const decs = this.renderDecisions(snapshot);
        if (decs)
            sections.push(decs);
        // 4. Remaining Open Gaps, Conflicts, & Tensions
        const openGaps = snapshot.gaps.gaps.filter((g) => g.status === 'open');
        if (openGaps.length > 0) {
            const list = openGaps.map((g) => `- [${g.severity.toUpperCase()}] ${g.area}: ${g.reason}`).join('\n');
            sections.push(`## Unresolved Gaps\n${list}`);
        }
        if (snapshot.gaps.conflicts.length > 0) {
            const list = snapshot.gaps.conflicts.map((c) => `- [${c.severity.toUpperCase()}] ${c.reason}`).join('\n');
            sections.push(`## Unresolved Conflicts\n${list}`);
        }
        // 5. Active Assumptions
        const activeAsms = snapshot.assumptions.items.filter((a) => a.status === 'active');
        if (activeAsms.length > 0) {
            const list = activeAsms.map((a) => `- Assumption: ${a.statement} (${a.reason})`).join('\n');
            sections.push(`## Active Assumptions\n${list}`);
        }
        // 6. User Instructions
        const input = this.renderUserInput(payload);
        if (input)
            sections.push(input);
        return this.truncateToBudget(sections.filter(Boolean).join('\n\n'));
    }
}
//# sourceMappingURL=ReadinessContext.js.map