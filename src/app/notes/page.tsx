// Server Component: Fetch data from SQLite
import { getNotesData } from '@/lib/sqlite-api';
import NotesClient from '@/components/notes/notes-client';

export default async function NotesPage() {
    const { notes, cases } = await getNotesData();

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 bg-slate-50">
            <NotesClient initialNotes={notes} initialCases={cases} />
        </div>
    );
}