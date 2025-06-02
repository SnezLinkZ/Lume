#!/bin/bash

# Function to move and rename SVG files from a subdirectory with suffix
move_svgs() {
  local dir="$1"
  local suffix="$2"

  if [ -d "$dir" ]; then
    for file in "$dir"/*.svg; do
      [ -f "$file" ] || continue

      base="$(basename "$file" .svg)"
      new_name="${base}-${suffix}.svg"

      # If new file exists, prompt before overwriting
      if [ -e "$new_name" ]; then
        echo "File '$new_name' already exists. Overwrite '$file'? (y/n)"
        read -r answer
        if [ "$answer" != "y" ]; then
          echo "Skipping '$file'"
          continue
        fi
      fi

      mv "$file" "./$new_name"
      echo "Moved '$file' → './$new_name'"
    done
  else
    echo "Directory '$dir' does not exist, skipping."
  fi
}

move_svgs "filled" "filled"
move_svgs "bold" "bold"
