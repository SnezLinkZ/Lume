#!/bin/bash

# Move all .svg files in current directory and subdirectories to the top level,
# renaming them based on their path using dashes instead of slashes.

find . -type f -name "*.svg" | while read -r filepath; do
  # Remove the leading './'
  relative_path="${filepath#./}"

  # Replace slashes with dashes to form the new filename
  new_filename="${relative_path//\//-}"

  # Move to top-level directory (current working directory)
  target="./$new_filename"

  # Check if file with same name already exists
  if [ -e "$target" ]; then
    echo "File $target already exists. Overwrite? (y/n)"
    read -r answer
    if [ "$answer" != "y" ]; then
      echo "Skipping $filepath"
      continue
    fi
  fi

  # Move the file
  mv "$filepath" "$target"
done

echo "Done."
