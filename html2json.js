import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic';
import { select, selectAll } from 'hast-util-select';

const SELF_REF = 'self://#';

export default class HTMLConverter {
  constructor(html) {
    this.tree = fromHtmlIsomorphic(html);
    this.blocks = selectAll('main > div > div', this.tree);
    this.json = this.convertBlocksToJson();
  }

  convertBlocksToJson() {
    const metadata = this.getMetadata();
    const data = this.findAndConvert(metadata.schemaName);
    return { metadata, data };
  }

  getMetadata() {
    const baseMeta = this.findAndConvert('da-form');
    const { 'x-schema-name': schemaName, ...rest } = baseMeta;
    return { schemaName, ...rest };
  }

  getProperties(block) {
    return block.children.reduce((rdx, row) => {
      if (row.children) {
        const [keyCol, valCol] = selectAll(':scope > div', row);

        const key = keyCol.children[0].value.trim();

        // If there's absolutely no children in cell, return an empty string
        if (!valCol.children[0]?.value) {
          console.log('no value');
          rdx[key] = '';
        } else {
            // Attempt a list
            const ul = select('ul', valCol);
            if (ul) {
              const listItems = selectAll('li', ul);
              rdx[key] = this.getArrayValues(key, listItems);
            } else {
              // Plain text
              rdx[key] = this.getTypedValue(valCol.children[0].value);
            }
        }
      }
      return rdx;
    }, {});
  }

  /**
   * Find and convert a block to its basic JSON data
   * @param {String} searchTerm the block name or variation
   * @param {Boolean} searchRef if the variation should be used for search
   * @returns {Object} the JSON Object representing pug
   */
  findAndConvert(searchTerm, searchRef) {
    return this.blocks.reduce((acc, block) => {
      // If we are looking for a reference,
      // use the variation, not the block name
      const idx = searchRef ? 1 : 0;
      if (block.properties.className[idx] === searchTerm) {
        return this.getProperties(block);
      }
      return acc;
    }, {});
  }

  // We will always try to convert to a strong type.
  // The schema is responsible for knowing if it
  // is correct and converting back if necessary.
  getTypedValue(value) {
    // It it doesn't exist, resolve to empty
    if (!value) return '';

    // Attempt boolean
    const boolean = this.getBoolean(value);
    if (boolean !== null) return boolean;

    // Attempt reference
    const reference = this.getReference(value);
    if (reference !== null) return reference;

    // Attempt number
    const number = this.getNumber(value);
    if (number !== null) return number;

    return value;
  }

  getArrayValues(key, parent) {
    return parent.reduce((acc, listItem) => {
      // Only push non empty LIs
      if (listItem.children.length > 0) {
        const { value } = listItem.children[0];
        if (!value) {
          console.log(key);
          return '';
        }
        const reference = this.getReference(value);
        acc.push(reference || value);
      }
      return acc;
    }, []);
  }

  getReference(text) {
    if (text.startsWith(SELF_REF)) {
      const refId = text.split(SELF_REF)[1].replaceAll('/', '-');
      const reference = this.findAndConvert(refId, true);
      if (reference) return reference;
    }
    return null;
  }

  getBoolean(text) {
    if (text === 'true') return true;
    if (text === 'false') return false;
    return null;
  }

  getNumber(text) {
    const num = Number(text);
    const isNum = Number.isFinite(num);
    if (!isNum) return null;
    return num;
  }
}
