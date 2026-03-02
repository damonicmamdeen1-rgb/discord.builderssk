import { CodeBlock, dracula } from 'react-code-blocks';
import Styles from './App.module.css';
import Select, { Props } from 'react-select';
import { select_styles } from './Select';
import { ChangeEvent, Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { libs } from '../libs.config';
import { ClientFunction, IncludeCallback } from 'ejs';
import { RootState } from './state';
import { OnChangeValue } from 'react-select/dist/declarations/src/types';
import { Component } from 'components-sdk';
import { useTranslation } from 'react-i18next';

const codegenModules: {
    [name: string]: { default: ClientFunction };
} = import.meta.glob('./codegen/**/*.ejs', { eager: true });

const libComponents: {[name: string]: ClientFunction} = {};

for (const key of Object.keys(codegenModules)) {
    const match = key.match(/^\.\/codegen\/([^/]+)\/main(?:\.[^/]*)?\.ejs$/);
    if (match) {
        const group = match[1];
        libComponents[group] = codegenModules[key].default;
    }
}

const importCallback: IncludeCallback = (name, data) => {
    const mainDart = codegenModules['./codegen' + name]?.default;
    if (typeof mainDart === "undefined") throw Error(`Component ${name} doesn't exist.`)
    return mainDart(data, undefined, importCallback);
};

type selectOption = {
    label: string;
    value: string;
}

export function Codegen({state, page, setPage, setState} : {
    state: Component[],
    page: string,
    setPage: (page: string) => void,
    setState: (value: Component[]) => void
}) {

    // In this scope of code null === JSON, this may change in the future
    const libSelected = page === '200.home' ? 'json' : page;
    const {t} = useTranslation("website");
    const setLibSelected = (lib: string) => setPage(lib === 'json' ? '200.home' : lib);

    const selectOptions: selectOption[] = [
        {
            label: 'JSON',
            value: 'json',
        },
        ...Object.keys(libComponents).map((comp) => ({
            label: libs[comp]?.name || comp,
            value: comp,
        })),
    ];

    let data;
    let language = 'json';

    if (Object.keys(libComponents).includes(libSelected)) {
        const renderer = libComponents[libSelected];
        data = renderer({components: state}, undefined, importCallback);
        language = libs[libSelected]?.language || 'json';
    } else {
        data = JSON.stringify(state, undefined, 4)
    }

    const isJsonMode = !Object.keys(libComponents).includes(libSelected);

    const [editText, setEditText] = useState<string>(data);
    const [jsonError, setJsonError] = useState<string | null>(null);
    const isFocused = useRef(false);
    const parseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isPaste = useRef(false);

    useEffect(() => {
        if (!isFocused.current) {
            setEditText(JSON.stringify(state, undefined, 4));
        }
    }, [state]);

    const handleJsonChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        setEditText(text);
        if (parseTimeout.current) clearTimeout(parseTimeout.current);
        const delay = isPaste.current ? 0 : 300;
        isPaste.current = false;
        parseTimeout.current = setTimeout(() => {
            try {
                const parsed = JSON.parse(text);
                if (Array.isArray(parsed)) {
                    setState(parsed);
                    setJsonError(null);
                } else {
                    setJsonError('Root value must be an array');
                }
            } catch (err) {
                setJsonError((err as Error).message);
            }
        }, delay);
    };

    const handlePaste = () => {
        isPaste.current = true;
    };

    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(data).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <>
            <p style={{ marginBottom: '0.5rem', marginTop: '8rem' }}>{t('codegen.title')}</p>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                    <Select
                        styles={select_styles}
                        options={selectOptions}
                        isMulti={false}
                        value={selectOptions.find((opt) => opt.value === libSelected)}
                        onChange={
                            ((newValue: OnChangeValue<selectOption, false>) => {
                                if (newValue) setLibSelected(newValue.value);
                            }) as Props['onChange']
                        }
                    />
                </div>

                <button
                    className={Styles.button}
                    onClick={handleCopy}
                    disabled={copied}
                    style={{ whiteSpace: 'nowrap', minWidth: '100px' }}
                >
                    {copied ? t('codegen.copied.button') : t('codegen.copy.button')}
                </button>
            </div>

            <div className={Styles.data}>
                {isJsonMode ? (
                    <>
                        <textarea
                            className={Styles.editor}
                            value={editText}
                            onChange={handleJsonChange}
                            onPaste={handlePaste}
                            onFocus={() => { isFocused.current = true; }}
                            onBlur={() => { isFocused.current = false; }}
                            spellCheck={false}
                        />
                        {jsonError && <p className={Styles.jsonError}>{jsonError}</p>}
                    </>
                ) : (
                    <CodeBlock text={data} language={language} showLineNumbers={false} theme={dracula} />
                )}
            </div>
        </>
    );
}
