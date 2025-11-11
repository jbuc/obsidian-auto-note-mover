import { App, normalizePath, Notice, TFile, TFolder } from 'obsidian';
import type { RuleAction, MoveAction, ApplyTemplateAction, RenameAction } from './filterTypes';

export interface ActionContext {
	app: App;
	file: TFile;
}

export async function executeActions(actions: RuleAction[], context: ActionContext): Promise<void> {
	for (const action of actions) {
		switch (action.type) {
			case 'move':
				context.file = await executeMoveAction(action, context);
				break;
			case 'applyTemplate':
				await executeTemplateAction(action, context);
				break;
			case 'rename':
				context.file = await executeRenameAction(action, context);
				break;
			default:
				console.warn('[Auto Note Mover] Unsupported action type', action);
		}
	}
}

async function executeMoveAction(action: MoveAction, context: ActionContext): Promise<TFile> {
	const targetFolder = normalizePath(action.targetFolder);
	await ensureFolderExists(context.app, targetFolder, action.createFolderIfMissing);
	const newPath = normalizePath(`${targetFolder}/${context.file.name}`);
	await context.app.fileManager.renameFile(context.file, newPath);
	new Notice(`[Auto Note Mover]\nMoved note to "${targetFolder}".`);
	const refreshed = context.app.vault.getAbstractFileByPath(newPath);
	if (refreshed instanceof TFile) {
		return refreshed;
	}
	return context.file;
}

async function executeTemplateAction(action: ApplyTemplateAction, context: ActionContext): Promise<void> {
	const templatePath = normalizePath(action.templatePath);
	const templateFile = context.app.vault.getAbstractFileByPath(templatePath);
	if (!(templateFile instanceof TFile)) {
		console.warn('[Auto Note Mover] Template not found:', templatePath);
		return;
	}
	const templateContent = await context.app.vault.read(templateFile);
	const currentContent = await context.app.vault.read(context.file);
	let nextContent = currentContent;
	switch (action.mode) {
		case 'prepend':
			nextContent = templateContent + '\n' + currentContent;
			break;
		case 'append':
			nextContent = currentContent + '\n' + templateContent;
			break;
		case 'replace':
			nextContent = templateContent;
			break;
		default:
			break;
	}
	if (nextContent !== currentContent) {
		await context.app.vault.modify(context.file, nextContent);
	}
}

async function executeRenameAction(action: RenameAction, context: ActionContext): Promise<TFile> {
	let newBaseName = action.replace ?? context.file.basename;
	if (action.prefix) {
		newBaseName = `${action.prefix}${newBaseName}`;
	}
	if (action.suffix) {
		newBaseName = `${newBaseName}${action.suffix}`;
	}
	if (newBaseName === context.file.basename) {
		return context.file;
	}
	const folder = context.file.parent?.path ?? '';
	const newPath = normalizePath(`${folder}/${newBaseName}.${context.file.extension}`);
	await context.app.fileManager.renameFile(context.file, newPath);
	const refreshed = context.app.vault.getAbstractFileByPath(newPath);
	if (refreshed instanceof TFile) {
		return refreshed;
	}
	return context.file;
}

async function ensureFolderExists(app: App, folderPath: string, allowCreate = false): Promise<void> {
	const normalized = normalizePath(folderPath);
	const existing = app.vault.getAbstractFileByPath(normalized);
	if (existing instanceof TFolder) {
		return;
	}
	if (!allowCreate) {
		throw new Error(`Destination folder "${folderPath}" does not exist.`);
	}
	await app.vault.createFolder(normalized);
}
