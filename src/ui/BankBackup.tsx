import {useEffect, useState} from 'react';
import {Download, Upload} from 'lucide-react';
import {client} from '../client';
import type {Locale} from './classic/Navigation';

export function BankBackup({locale, ownerId, online}: {locale: Locale; ownerId: string; online: boolean}) {
  const id = locale === 'id';
  const [configured, setConfigured] = useState<boolean>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    setConfigured(undefined);
    if (online) void client.storageStatus().then(
      value => { if (current) setConfigured(value.configured); },
      error => { if (current) setError(error.message); }
    );
    return () => { current = false; };
  }, [ownerId, online]);

  async function run(action: 'save' | 'download') {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      if (action === 'save') {
        const result = await client.backupBanks();
        setMessage(id ? `${result.count} bank dicadangkan.` : `${result.count} banks backed up.`);
      } else {
        const backup = await client.downloadBankBackup();
        const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], {type: 'application/json'}));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'noodl-banks-backup.json';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <section>
    <h3>{id ? 'Cadangan Supabase' : 'Supabase backup'}</h3>
    {configured === false && <p>{id ? 'Supabase belum terhubung. Bank tersimpan di server Noodl.' : 'Supabase is disconnected. Banks are stored on the Noodl server.'}</p>}
    {configured && <>
      <p>{id
        ? 'Simpan bank dan materi ke cadangan privat. Menyimpan lagi mengganti cadangan sebelumnya. File JSON dapat diimpor dari Bank soal.'
        : 'Back up question banks and study materials privately. Saving replaces the previous backup. Import the JSON from Question banks.'}</p>
      <div className="n-row">
        <button className="n-button" disabled={busy || !online} onClick={() => void run('save')}>
          <Upload size={16}/>{id ? 'Cadangkan bank' : 'Back up banks'}
        </button>
        <button className="n-button" disabled={busy || !online} onClick={() => void run('download')}>
          <Download size={16}/>{id ? 'Unduh cadangan' : 'Download backup'}
        </button>
      </div>
    </>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
