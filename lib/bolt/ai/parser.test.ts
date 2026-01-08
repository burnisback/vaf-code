/**
 * Parser Unit Tests
 *
 * Tests for the vafArtifact/vafAction XML parser.
 */

import { describe, it, expect } from 'vitest';
import {
  parseArtifacts,
  extractTextContent,
  hasArtifacts,
  validateArtifact,
  StreamingParser,
  toBoltArtifacts,
} from './parser';

describe('parseArtifacts', () => {
  it('should parse a single artifact with file action', () => {
    const input = `
Here's the code:
<vafArtifact id="test-component" title="Test Component">
  <vafAction type="file" filePath="src/Test.tsx">
import React from 'react';

export function Test() {
  return <div>Hello</div>;
}
  </vafAction>
</vafArtifact>
Done!
`;

    const artifacts = parseArtifacts(input);

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].id).toBe('test-component');
    expect(artifacts[0].title).toBe('Test Component');
    expect(artifacts[0].actions).toHaveLength(1);
    expect(artifacts[0].actions[0].type).toBe('file');
    expect(artifacts[0].actions[0].filePath).toBe('src/Test.tsx');
    expect(artifacts[0].actions[0].content).toContain('export function Test');
  });

  it('should parse multiple actions in one artifact', () => {
    const input = `
<vafArtifact id="multi-action" title="Multiple Actions">
  <vafAction type="shell">
npm install react-icons
  </vafAction>
  <vafAction type="file" filePath="src/App.tsx">
import { FaHeart } from 'react-icons/fa';
  </vafAction>
</vafArtifact>
`;

    const artifacts = parseArtifacts(input);

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].actions).toHaveLength(2);
    expect(artifacts[0].actions[0].type).toBe('shell');
    expect(artifacts[0].actions[0].content).toContain('npm install');
    expect(artifacts[0].actions[1].type).toBe('file');
    expect(artifacts[0].actions[1].filePath).toBe('src/App.tsx');
  });

  it('should parse multiple artifacts', () => {
    const input = `
<vafArtifact id="first" title="First">
  <vafAction type="file" filePath="a.ts">const a = 1;</vafAction>
</vafArtifact>
Some text between.
<vafArtifact id="second" title="Second">
  <vafAction type="file" filePath="b.ts">const b = 2;</vafAction>
</vafArtifact>
`;

    const artifacts = parseArtifacts(input);

    expect(artifacts).toHaveLength(2);
    expect(artifacts[0].id).toBe('first');
    expect(artifacts[1].id).toBe('second');
  });

  it('should strip markdown code blocks', () => {
    const input = `
\`\`\`xml
<vafArtifact id="wrapped" title="Wrapped in Code Block">
  <vafAction type="file" filePath="test.ts">const x = 1;</vafAction>
</vafArtifact>
\`\`\`
`;

    const artifacts = parseArtifacts(input);

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].id).toBe('wrapped');
  });

  it('should return empty array for no artifacts', () => {
    const input = 'Just some text without any artifacts.';
    const artifacts = parseArtifacts(input);
    expect(artifacts).toHaveLength(0);
  });
});

describe('hasArtifacts', () => {
  it('should return true when artifacts exist', () => {
    const input = '<vafArtifact id="test" title="Test"><vafAction type="file" filePath="x">y</vafAction></vafArtifact>';
    expect(hasArtifacts(input)).toBe(true);
  });

  it('should return false when no artifacts exist', () => {
    const input = 'No artifacts here';
    expect(hasArtifacts(input)).toBe(false);
  });
});

describe('extractTextContent', () => {
  it('should extract text outside artifacts', () => {
    const input = `
Hello, here's the code:
<vafArtifact id="test" title="Test">
  <vafAction type="file" filePath="x.ts">content</vafAction>
</vafArtifact>
Let me know if you need anything else!
`;

    const text = extractTextContent(input);

    expect(text).toContain('Hello');
    expect(text).toContain('Let me know');
    expect(text).not.toContain('vafArtifact');
    expect(text).not.toContain('content');
  });
});

describe('validateArtifact', () => {
  it('should return no errors for valid artifact', () => {
    const artifact = {
      id: 'valid',
      title: 'Valid Artifact',
      actions: [
        { type: 'file' as const, filePath: 'test.ts', content: 'const x = 1;' },
      ],
    };

    const errors = validateArtifact(artifact);
    expect(errors).toHaveLength(0);
  });

  it('should return error for missing id', () => {
    const artifact = {
      id: '',
      title: 'No ID',
      actions: [{ type: 'file' as const, filePath: 'x.ts', content: 'y' }],
    };

    const errors = validateArtifact(artifact);
    expect(errors).toContain('Artifact missing id');
  });

  it('should return error for file action without filePath', () => {
    const artifact = {
      id: 'test',
      title: 'Test',
      actions: [{ type: 'file' as const, content: 'content' }],
    };

    const errors = validateArtifact(artifact);
    expect(errors.some(e => e.includes('filePath'))).toBe(true);
  });

  it('should return error for empty content', () => {
    const artifact = {
      id: 'test',
      title: 'Test',
      actions: [{ type: 'shell' as const, content: '   ' }],
    };

    const errors = validateArtifact(artifact);
    expect(errors.some(e => e.includes('empty content'))).toBe(true);
  });
});

describe('StreamingParser', () => {
  it('should parse artifacts incrementally', () => {
    const parser = new StreamingParser();

    // First chunk - partial artifact
    const result1 = parser.append('Hello <vafArtifact id="test" title="Test">');
    expect(result1.newArtifacts).toHaveLength(0);
    expect(result1.newText).toContain('Hello');

    // Second chunk - complete the action
    const result2 = parser.append('<vafAction type="file" filePath="x.ts">const x = 1;</vafAction>');
    expect(result2.newArtifacts).toHaveLength(0);

    // Third chunk - close artifact
    const result3 = parser.append('</vafArtifact> Done!');
    expect(result3.newArtifacts).toHaveLength(1);
    expect(result3.newArtifacts[0].id).toBe('test');
  });

  it('should finalize properly', () => {
    const parser = new StreamingParser();

    parser.append('Some text ');
    parser.append('<vafArtifact id="a" title="A"><vafAction type="shell">npm test</vafAction></vafArtifact>');
    parser.append(' More text');

    const final = parser.finalize();

    expect(final.artifacts).toHaveLength(1);
    expect(final.text).toContain('Some text');
    expect(final.text).toContain('More text');
  });

  it('should reset state', () => {
    const parser = new StreamingParser();

    parser.append('<vafArtifact id="a" title="A"><vafAction type="shell">x</vafAction></vafArtifact>');
    parser.reset();

    const result = parser.finalize();
    expect(result.artifacts).toHaveLength(0);
    expect(result.text).toBe('');
  });
});

describe('toBoltArtifacts', () => {
  it('should convert parsed artifacts to Bolt types', () => {
    const parsed = [
      {
        id: 'test',
        title: 'Test',
        actions: [
          { type: 'file' as const, filePath: 'x.ts', content: 'y' },
        ],
      },
    ];

    const boltArtifacts = toBoltArtifacts(parsed);

    expect(boltArtifacts).toHaveLength(1);
    expect(boltArtifacts[0].actions[0].status).toBe('pending');
  });
});
