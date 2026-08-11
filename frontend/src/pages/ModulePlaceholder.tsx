import { PageHeader } from '../shell/AppShell';
import { Card, EmptyState } from '../ui/primitives';

/**
 * A ratified destination whose owning module is not implemented.
 *
 * <p>🔴 Visually legitimate, semantically EMPTY. It shows no KPI, no order, no stock count,
 * no revenue figure, no demo user and no workflow — `UX-006` forbids inventing a screen,
 * and inventing sample data would be inventing business meaning (`CLAUDE.md` §5).
 *
 * <p>It exists to prove navigation and shell composition, and is replaced wholesale by the
 * owning module when that module is implemented.
 */
export default function ModulePlaceholder({ title }: { readonly title: string }): React.JSX.Element {
  return (
    <>
      <PageHeader title={title} subtitle="Module implementation pending" />
      <Card>
        <EmptyState
          title="Not implemented yet"
          guidance={`${title} has a ratified place in the navigation, but its owning module has not been built. Nothing is shown here because no business data exists.`}
        />
      </Card>
    </>
  );
}
