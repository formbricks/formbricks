package com.formbricks.formbrickssdk.extensions

/**
 * Swift like guard statement.
 * To achieve that, on null the statement must return an empty T object
 */
inline fun <reified T> T?.guard(block: T?.() -> Unit): T {
    this?.let {
        return it
    } ?: run {
        block()
    }

    return T::class.java.newInstance()
}

inline fun String?.guardEmpty(block: String?.() -> Unit): String {
    if (isNullOrBlank()) {
        block()
    } else {
        return this
    }

    return ""
}

inline fun <T: Any> guardLet(vararg elements: T?, closure: () -> Nothing): List<T> {
    return if (elements.all { it != null }) {
        elements.filterNotNull()
    } else {
        closure()
    }
}
