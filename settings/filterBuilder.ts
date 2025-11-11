import { FilterRule, FilterNode, FilterGroup, FilterCondition, RuleAction } from 'filter/filterTypes';

type OnChange = () => Promise<void> | void;

const COMPARATORS: FilterCondition['comparator'][] = [
	'equals',
	'contains',
	'startsWith',
	'endsWith',
	'matchesRegex',
	'exists',
	'notExists',
];

const ACTION_TYPES: RuleAction['type'][] = ['move', 'applyTemplate', 'rename', 'addTag', 'removeTag'];

export const renderFilterRulesEditor = (
	containerEl: HTMLElement,
	rules: FilterRule[],
	onChange: OnChange
): void => {
	const wrapper = containerEl.createDiv('anm-filter-rules');

	const refresh = () => {
		wrapper.empty();
		build();
	};

	const notify = async () => {
		await onChange();
	};

	const notifyAndRefresh = async () => {
		await onChange();
		refresh();
	};

	const build = () => {
		if (!rules.length) {
			wrapper.createEl('p', { text: 'No rules yet. Add one below.' });
		}
		rules.forEach((rule, index) => {
			renderRuleCard(wrapper, rule, index);
		});

		const addRuleButton = wrapper.createEl('button', { text: 'Add rule', cls: 'anm-btn' });
		addRuleButton.onclick = async () => {
			rules.push(createDefaultRule());
			await notifyAndRefresh();
		};
	};

	const renderRuleCard = (parent: HTMLElement, rule: FilterRule, index: number) => {
		const card = parent.createDiv('anm-rule-card');
		const header = card.createDiv('anm-rule-header');

		const nameInput = header.createEl('input', { value: rule.name, attr: { placeholder: 'Rule name' } });
		nameInput.oninput = async () => {
			rule.name = nameInput.value;
			await notify();
		};

		const enabledLabel = header.createSpan({ text: 'Enabled' });
		const enabledToggle = header.createEl('input', { type: 'checkbox' });
		enabledToggle.checked = rule.enabled;
		enabledToggle.onchange = async () => {
			rule.enabled = enabledToggle.checked;
			await notify();
		};
		header.append(enabledLabel, enabledToggle);

		const stopLabel = header.createSpan({ text: 'Stop on match' });
		const stopToggle = header.createEl('input', { type: 'checkbox' });
		stopToggle.checked = !!rule.stopOnMatch;
		stopToggle.onchange = async () => {
			rule.stopOnMatch = stopToggle.checked;
			await notify();
		};
		header.append(stopLabel, stopToggle);

		const deleteButton = header.createEl('button', { text: 'Delete', cls: 'anm-btn-danger' });
		deleteButton.onclick = async () => {
			rules.splice(index, 1);
			await notifyAndRefresh();
		};

		// Filter tree
		card.createEl('h4', { text: 'Filter criteria' });
		renderFilterNodeEditor(card, rule.filter, null, null, notify, notifyAndRefresh);

		// Actions
		card.createEl('h4', { text: 'Actions' });
		renderActionsEditor(card, rule.actions, notify, notifyAndRefresh);
	};

	const renderFilterNodeEditor = (
		container: HTMLElement,
		node: FilterNode,
		parentChildren: FilterNode[] | null,
		index: number | null,
		notifyChange: () => Promise<void>,
		notifyAndRefresh: () => Promise<void>
	) => {
		if (node.type === 'group') {
			const groupEl = container.createDiv('anm-group');
			const operatorSelect = groupEl.createEl('select');
			['all', 'any', 'none'].forEach((op) => {
				operatorSelect.append(new Option(op, op, false, node.operator === op));
			});
			operatorSelect.onchange = async () => {
				node.operator = operatorSelect.value as FilterGroup['operator'];
				await notifyChange();
			};

			const removeButton =
				parentChildren && index !== null
					? groupEl.createEl('button', { text: 'Remove group', cls: 'anm-btn-danger' })
					: null;
			if (removeButton) {
				removeButton.onclick = async () => {
					parentChildren.splice(index!, 1);
					await notifyAndRefresh();
				};
			}

			const childrenContainer = groupEl.createDiv('anm-group-children');
			node.children.forEach((child, childIndex) => {
				renderFilterNodeEditor(childrenContainer, child, node.children, childIndex, notifyChange, notifyAndRefresh);
			});

			const addConditionBtn = groupEl.createEl('button', { text: 'Add condition', cls: 'anm-btn' });
			addConditionBtn.onclick = async () => {
				node.children.push(createDefaultCondition());
				await notifyAndRefresh();
			};
			const addGroupBtn = groupEl.createEl('button', { text: 'Add group', cls: 'anm-btn' });
			addGroupBtn.onclick = async () => {
				node.children.push(createDefaultGroup());
				await notifyAndRefresh();
			};
		} else {
			const conditionEl = container.createDiv('anm-condition');
			const propInput = conditionEl.createEl('input', {
				value: node.property,
				attr: { placeholder: 'Property (e.g., file.name, frontmatter.type)' },
			});
			propInput.oninput = async () => {
				node.property = propInput.value;
				await notifyChange();
			};

			const comparatorSelect = conditionEl.createEl('select');
			COMPARATORS.forEach((comp) => {
				comparatorSelect.append(new Option(comp, comp, false, node.comparator === comp));
			});
			comparatorSelect.onchange = async () => {
				node.comparator = comparatorSelect.value as FilterCondition['comparator'];
				await notifyChange();
			};

			const valueInput = conditionEl.createEl('input', {
				value: Array.isArray(node.value) ? node.value.join(',') : node.value ?? '',
				attr: { placeholder: 'Value (optional)' },
			});
			valueInput.oninput = async () => {
				node.value = valueInput.value;
				await notifyChange();
			};

			const caseCheckbox = conditionEl.createEl('input', { type: 'checkbox' });
			caseCheckbox.checked = !!node.caseSensitive;
			caseCheckbox.onchange = async () => {
				node.caseSensitive = caseCheckbox.checked;
				await notifyChange();
			};
			conditionEl.createSpan({ text: 'Case sensitive' }).append(caseCheckbox);

			const negateCheckbox = conditionEl.createEl('input', { type: 'checkbox' });
			negateCheckbox.checked = !!node.negate;
			negateCheckbox.onchange = async () => {
				node.negate = negateCheckbox.checked;
				await notifyChange();
			};
			conditionEl.createSpan({ text: 'Negate' }).append(negateCheckbox);

			if (parentChildren && index !== null) {
				const removeBtn = conditionEl.createEl('button', { text: 'Remove', cls: 'anm-btn-danger' });
				removeBtn.onclick = async () => {
					parentChildren.splice(index!, 1);
					await notifyAndRefresh();
				};
			}
		}
	};

	const renderActionsEditor = (
		container: HTMLElement,
		actions: RuleAction[],
		notifyChange: () => Promise<void>,
		notifyAndRefresh: () => Promise<void>
	) => {
		const list = container.createDiv('anm-actions');
		actions.forEach((action, index) => {
			const actionEl = list.createDiv('anm-action');

			const typeSelect = actionEl.createEl('select');
			ACTION_TYPES.forEach((type) => {
				typeSelect.append(new Option(type, type, false, action.type === type));
			});
			typeSelect.onchange = async () => {
				actions[index] = createDefaultAction(typeSelect.value as RuleAction['type']);
				await notifyAndRefresh();
			};

			renderActionFields(actionEl, action, async () => {
				await notifyChange();
			});

			const removeBtn = actionEl.createEl('button', { text: 'Remove', cls: 'anm-btn-danger' });
			removeBtn.onclick = async () => {
				actions.splice(index, 1);
				await notifyAndRefresh();
			};
		});

		const addActionBtn = container.createEl('button', { text: 'Add action', cls: 'anm-btn' });
		addActionBtn.onclick = async () => {
			actions.push(createDefaultAction('move'));
			await notifyAndRefresh();
		};
	};

	const renderActionFields = (container: HTMLElement, action: RuleAction, notifyChange: () => Promise<void>) => {
		switch (action.type) {
			case 'move': {
				const input = container.createEl('input', {
					value: action.targetFolder,
					attr: { placeholder: 'Destination folder' },
				});
				input.oninput = async () => {
					action.targetFolder = input.value;
					await notifyChange();
				};
				const createToggle = container.createEl('input', { type: 'checkbox' });
				createToggle.checked = !!action.createFolderIfMissing;
				createToggle.onchange = async () => {
					action.createFolderIfMissing = createToggle.checked;
					await notifyChange();
				};
				container.createSpan({ text: 'Create folder if missing' }).append(createToggle);
				break;
			}
			case 'applyTemplate': {
				const pathInput = container.createEl('input', {
					value: action.templatePath,
					attr: { placeholder: 'Template path (relative to vault)' },
				});
				pathInput.oninput = async () => {
					action.templatePath = pathInput.value;
					await notifyChange();
				};
				const modeSelect = container.createEl('select');
				['prepend', 'append', 'replace'].forEach((mode) => {
					modeSelect.append(new Option(mode, mode, false, action.mode === mode));
				});
				modeSelect.onchange = async () => {
					action.mode = modeSelect.value as typeof action.mode;
					await notifyChange();
				};
				break;
			}
			case 'rename': {
				const prefixInput = container.createEl('input', {
					value: action.prefix ?? '',
					attr: { placeholder: 'Prefix' },
				});
				prefixInput.oninput = async () => {
					action.prefix = prefixInput.value || undefined;
					await notifyChange();
				};
				const suffixInput = container.createEl('input', {
					value: action.suffix ?? '',
					attr: { placeholder: 'Suffix' },
				});
				suffixInput.oninput = async () => {
					action.suffix = suffixInput.value || undefined;
					await notifyChange();
				};
				const replaceInput = container.createEl('input', {
					value: action.replace ?? '',
					attr: { placeholder: 'Replace basename' },
				});
				replaceInput.oninput = async () => {
					action.replace = replaceInput.value || undefined;
					await notifyChange();
				};
				break;
			}
			case 'addTag':
			case 'removeTag': {
				const tagInput = container.createEl('input', {
					value: action.tag,
					attr: { placeholder: '#tag' },
				});
				tagInput.oninput = async () => {
					action.tag = tagInput.value;
					await notifyChange();
				};
				break;
			}
			default:
				container.createSpan({ text: 'Unsupported action type.' });
		}
	};

	refresh();
};

const createDefaultCondition = (): FilterCondition => ({
	type: 'condition',
	property: '',
	comparator: 'equals',
	value: '',
	caseSensitive: false,
	negate: false,
});

const createDefaultGroup = (): FilterGroup => ({
	type: 'group',
	operator: 'all',
	children: [createDefaultCondition()],
});

const createDefaultAction = (type: RuleAction['type']): RuleAction => {
	switch (type) {
		case 'move':
			return { type, targetFolder: '', createFolderIfMissing: false };
		case 'applyTemplate':
			return { type, templatePath: '', mode: 'prepend' };
		case 'rename':
			return { type };
		case 'addTag':
		case 'removeTag':
			return { type, tag: '' };
		default:
			return { type: 'move', targetFolder: '' };
	}
};

const createDefaultRule = (): FilterRule => ({
	id: `rule-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
	name: 'New rule',
	enabled: true,
	filter: createDefaultGroup(),
	actions: [createDefaultAction('move')],
	stopOnMatch: true,
});
