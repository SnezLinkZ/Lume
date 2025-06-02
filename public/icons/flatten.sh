#!/bin/bash

# Loop through all regular files in the current directory
for file in *; do
  [ -f "$file" ] || continue

  # Replace dash immediately after "duo" with underscore
  new_file="$(echo "$file" | sed 's/\(duo\)-/\1_/')"

  # Rename if the filename has changed
  if [ "$file" != "$new_file" ]; then
    if [ -e "$new_file" ]; then
      echo "File '$new_file' already exists. Overwrite '$file'? (y/n)"
      read -r answer
      if [ "$answer" != "y" ]; then
        echo "Skipping '$file'"
        continue
      fi
    fi

    mv "$file" "$new_file"
    echo "Renamed '$file' → '$new_file'"
  fi
done
