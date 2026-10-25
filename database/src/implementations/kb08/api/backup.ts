import { GET, POST, DELETE } from '@/implementations/kb08/services/request';
import type { Props as CreateBackupPros } from '@/implementations/kb08/pages/api/backup/create';
import { adaptBackup } from '@/implementations/kb08/utils/adapt';
import { AutoBackupFormType } from '@/implementations/kb08/types/backup';
import type { Props as UpdatePolicyProps } from '@/implementations/kb08/pages/api/backup/updatePolicy';
import { BackupItemType } from '@/implementations/kb08/types/db';

export const createBackup = (data: CreateBackupPros) => POST('/api/backup/create', data);

export const getBackupList = (dbName: string) =>
  GET('/api/backup/getBackupList', { dbName }).then((res) => res.map(adaptBackup));

export const getBackups = () => GET<BackupItemType[]>('/api/backup/getBackups');

export const deleteBackup = (backupName: string) =>
  DELETE(`/api/backup/delBackup?backupName=${backupName}`);

export const updateBackupPolicy = (data: UpdatePolicyProps) =>
  POST<AutoBackupFormType>(`/api/backup/updatePolicy`, data);
